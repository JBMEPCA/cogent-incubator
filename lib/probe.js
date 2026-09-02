// Liveness probes for a title's credentials.
//
// A settings form that only stores what you typed tells you nothing: a
// WordPress application password that was revoked, a Search Console property
// the service account was never granted, and a perfectly good credential all
// look identical in a text input. Each probe here makes one cheap, read-only
// call to the real service and comes back with either ok or the provider's own
// error, which is the only wording that reliably points at the right console.
//
// Nothing here writes to the third-party service. The outreach probe in
// particular checks that Gmail will MINT A TOKEN for the mailbox, and stops
// short of sending anything.
// Explicit extension so scripts/migrate-credential.mjs can run these probes
// under plain Node, outside the Next bundler. Next resolves it either way.
import { getGoogleAccessToken, isGoogleConfigured, googleServiceAccountEmail } from "./google.js";

const trim = (s) => String(s || "").replace(/\/$/, "");

/** WordPress: can these credentials see the REST API as a user who can publish? */
async function probeWordPress(wp) {
  if (!wp?.url || !wp?.username || !wp?.appPassword) {
    return { ok: false, error: "URL, username and application password are all required." };
  }
  let base;
  try {
    base = new URL(trim(wp.url)).origin;
  } catch {
    return { ok: false, error: `"${wp.url}" is not a valid URL. Include https://.` };
  }

  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  let res;
  try {
    res = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, {
      headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: `Could not reach ${base}: ${e.message}` };
  }

  if (res.status === 401) {
    return { ok: false, error: "WordPress rejected the application password (401). Regenerate it in Users → Profile → Application Passwords." };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `WordPress returned ${res.status}. ${body.slice(0, 200)}` };
  }

  const me = await res.json().catch(() => ({}));
  const caps = me.capabilities || {};

  // Publishing is the whole point, so a connection that authenticates as a
  // contributor is a failure rather than a pass with a caveat: it would sail
  // through setup and then silently produce drafts nobody ever sees.
  if (!caps.publish_posts) {
    return { ok: false, error: `Connected as ${me.name || wp.username}, but that account cannot publish posts. It needs the editor role.` };
  }
  // An administrator works, but it is more authority than the engine should
  // hold. Flagged, not failed — see CREDENTIAL_KINDS.wordpress.
  const warning = caps.manage_options
    ? `Connected as an administrator. An editor-role account is enough and safer.`
    : null;

  return { ok: true, detail: `Connected as ${me.name || me.slug} (id ${me.id})`, warning };
}

/** Search Console + GA4: has the fleet service account actually been granted access? */
async function probeGoogleAnalytics(ga) {
  if (!isGoogleConfigured()) {
    return { ok: false, error: "No fleet service-account key. Set GOOGLE_SERVICE_ACCOUNT_JSON." };
  }
  if (!ga?.gscSiteUrl && !ga?.ga4PropertyId) {
    return { ok: false, error: "Give at least a Search Console property or a GA4 property id." };
  }

  const sa = googleServiceAccountEmail() || "the service account";
  const details = [];

  if (ga.gscSiteUrl) {
    let token;
    try {
      token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
    } catch (e) {
      return { ok: false, error: `Google refused a token: ${e.message}` };
    }
    // The site list is the honest test: it returns exactly the properties this
    // service account has been added to, so a missing grant is unambiguous
    // rather than an empty data set that looks like a quiet site.
    const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Search Console returned ${res.status}. ${body.slice(0, 200)}` };
    }
    const body = await res.json().catch(() => ({}));
    const entries = body.siteEntry || [];
    const match = entries.find((e) => e.siteUrl === ga.gscSiteUrl);
    if (!match) {
      const known = entries.map((e) => e.siteUrl).slice(0, 5).join(", ") || "nothing at all";
      return {
        ok: false,
        error: `${sa} cannot see ${ga.gscSiteUrl}. Add it as a user in Search Console → Settings → Users and permissions. It currently sees: ${known}.`,
      };
    }
    details.push(`Search Console ${match.permissionLevel}`);
  }

  if (ga.ga4PropertyId) {
    const id = String(ga.ga4PropertyId).replace(/^properties\//, "");
    if (!/^\d+$/.test(id)) {
      return { ok: false, error: `GA4 property id should be numeric (from GA4 Admin → Property settings), got "${ga.ga4PropertyId}".` };
    }
    let token;
    try {
      token = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
    } catch (e) {
      return { ok: false, error: `Google refused an Analytics token: ${e.message}` };
    }
    const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${id}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 403) {
      return { ok: false, error: `${sa} has no access to GA4 property ${id}. Add it as a Viewer in GA4 Admin → Property access management.` };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `GA4 returned ${res.status}. ${body.slice(0, 200)}` };
    }
    const prop = await res.json().catch(() => ({}));
    details.push(`GA4 "${prop.displayName || id}"`);
  }

  return { ok: true, detail: details.join(" · ") };
}

/** Mailchimp: does the fleet key hold this title's audience? */
async function probeMailchimp(mc) {
  const key = process.env.MAILCHIMP_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return { ok: false, error: "No fleet Mailchimp key. Set MAILCHIMP_API_KEY." };
  if (!mc?.audienceId) return { ok: false, error: "Audience id is required." };

  const dc = key.split("-").pop();
  const auth = "Basic " + Buffer.from(`anystring:${key}`).toString("base64");
  let res;
  try {
    res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${mc.audienceId}`, {
      headers: { authorization: auth },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: `Could not reach Mailchimp: ${e.message}` };
  }
  if (res.status === 404) {
    return { ok: false, error: `Audience ${mc.audienceId} does not exist on this Mailchimp account.` };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: `Mailchimp returned ${res.status}: ${body.detail || ""}` };
  }
  const list = await res.json().catch(() => ({}));
  return {
    ok: true,
    detail: `"${list.name}" — ${list.stats?.member_count ?? 0} subscribers`,
    // A from address that is not verified on the sending domain bounces the
    // whole campaign, and Mailchimp only says so at send time.
    warning: mc.fromEmail ? null : "No from address set — the issue cannot be sent without one.",
  };
}

/**
 * Outreach: will Gmail mint a send token for this mailbox?
 *
 * This is the probe that catches the two failures that otherwise only show up
 * when a real email fails to send: domain-wide delegation not granted, and the
 * Gmail API not enabled on the project.
 */
async function probeOutreach(out) {
  if (!isGoogleConfigured()) {
    return { ok: false, error: "No fleet service-account key. Set GOOGLE_SERVICE_ACCOUNT_JSON." };
  }
  if (!out?.fromEmail) return { ok: false, error: "From address is required." };
  if (!out?.postalAddress) {
    return { ok: false, error: "A postal address is required in the footer of UK B2B outreach. The send path refuses without one." };
  }

  const sa = googleServiceAccountEmail() || "the service account";

  // Minting the token IS the test, and the only one available.
  //
  // Under domain-wide delegation Google refuses the token exchange outright
  // (unauthorized_client) when the requested scope is not on the delegation, so
  // a token that comes back proves both that the mailbox can be impersonated and
  // that gmail.send is granted. There is deliberately no API call after this:
  // gmail.send does not permit users.getProfile, so probing with it reported
  // "insufficient authentication scopes" against a delegation that was in fact
  // correct — a false negative on the one integration hardest to re-test by hand.
  try {
    await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], out.fromEmail);
  } catch (e) {
    const msg = e.message || String(e);
    if (/invalid email or user id/i.test(msg)) {
      return { ok: false, error: `${out.fromEmail} is not a mailbox on this Google Workspace. (${msg})` };
    }
    if (/unauthorized_client/i.test(msg)) {
      return {
        ok: false,
        error: `Domain-wide delegation for client ${sa} does not include gmail.send. Add it in Google Admin → Security → API controls → Domain-wide delegation. (${msg})`,
      };
    }
    return { ok: false, error: `Google would not mint a send token for ${out.fromEmail}: ${msg}` };
  }

  // Reply detection reads the same mailbox, and readonly is a SEPARATE scope on
  // the delegation. Warn rather than fail: sending works without it, the queue
  // just cannot tell you who wrote back. Where it IS granted, getProfile is
  // permitted and confirms the mailbox end to end.
  let warning = null;
  let detail = `Can send as ${out.fromEmail}`;
  try {
    const readToken = await getGoogleAccessToken(
      ["https://www.googleapis.com/auth/gmail.readonly"],
      out.fromEmail
    );
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { authorization: `Bearer ${readToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const profile = await res.json().catch(() => ({}));
      if (profile.emailAddress) detail = `Can send and read as ${profile.emailAddress}`;
    } else {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `HTTP ${res.status}`;
      if (/has not been used in project|is disabled/i.test(msg)) {
        return {
          ok: false,
          error: `The Gmail API is not enabled on the Google Cloud project. Enable it in APIs and services → Library. (${msg})`,
        };
      }
      warning = `Reply detection may not work: Gmail returned ${msg}.`;
    }
  } catch {
    warning = "gmail.readonly is not delegated, so replies cannot be detected automatically.";
  }

  return { ok: true, detail, warning };
}

const PROBES = {
  wordpress: probeWordPress,
  google_analytics: probeGoogleAnalytics,
  mailchimp: probeMailchimp,
  outreach: probeOutreach,
};

/**
 * Run one kind's probe. Never throws: an unexpected failure is a red dot with
 * the message on it, not a 500 over the settings page.
 */
export async function probeCredential(kind, payload) {
  const fn = PROBES[kind];
  if (!fn) return { ok: false, error: `No probe for ${kind}` };
  try {
    return await fn(payload);
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
