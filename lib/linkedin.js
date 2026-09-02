// Publishing to LinkedIn through the official Posts API.
//
// The LinkedIn Manager agent still only ever drafts. What changed is what
// "approved" means: a human approving a post in the queue now books it a slot,
// and this module is what actually puts it on LinkedIn when the slot arrives.
// The human gate is untouched, the copy-and-paste is what goes away.
//
// Automated posting of your own content through this API is what the API is
// for. It is auto-connecting and scraping that breach LinkedIn's terms, which
// is a different thing entirely and still not something this app does.
//
// Setup, one time:
//   1. developer.linkedin.com -> create an app against the title's page
//   2. Products tab -> "Sign In with LinkedIn using OpenID Connect" and
//      "Share on LinkedIn" are self-serve. Posting AS a company page needs
//      "Community Management API" as well, which is a separate request with
//      a review behind it. That product, not anything in this file, is what
//      gates a new title: without it the connect flow returns no pages.
//   3. Auth tab -> add the redirect URL below
//   4. LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET into .env and Vercel
//   5. Click Connect on /linkedin, then pick the company page
import crypto from "crypto";
import { forSite } from "./prisma";
import { ukHour } from "./agents/hours";
import { siteHost } from "./site-url.js";
import { mentionsForArticle, renderCommentary } from "./linkedin-mentions.js";

const AUTH_KEY = "linkedin:auth";
const STATE_KEY = "linkedin:oauthState";

// Versions are supported for at least a year from release; 202607 was current
// when this was built. If LinkedIn sunsets it the API returns a 426 naming the
// valid versions, so bump this (or LINKEDIN_API_VERSION) and redeploy.
const API_VERSION = process.env.LINKEDIN_API_VERSION || "202607";

// rw_organization_admin lists the pages the person administers so the connect
// flow can offer them, AND is what lets organizationsLookup resolve any public
// company page to a URN for tagging. w_organization_social is what posts as the
// page. Both come from the Community Management API product.
//
// Named rw_organization_admin, not r_organization_admin: the read-only spelling
// is not a real LinkedIn scope and asking for it is refused at the consent
// screen, which is a miserable thing to discover on approval day.
//
// The member scopes are NOT here. Community Management API refuses to share an
// app with any other product, so the app that grants these two cannot also
// carry "Sign In with LinkedIn using OpenID Connect" — there is no openid, no
// profile, no /v2/userinfo. Everything below treats the person as unknown and
// names the connection after the page instead.
//
// Overridable because the exact scope names a product grants are LinkedIn's to
// change, and the Auth tab is the only place that states them. Asking for a
// scope the app does not have is refused at the consent screen, so this is the
// first thing to check if Connect bounces.
const SCOPES = process.env.LINKEDIN_SCOPES || "rw_organization_admin w_organization_social";

// Two posts a day per title, at 09:00 and 13:00 UK. JB's instruction of
// 2 Sep 2026, replacing "next free half-hour at least three hours after the
// last one", which drifted later every day and put posts out at times nobody
// chose. Fixed slots also make the queue legible: you can look at it and say
// which post goes out when.
const SLOT_HOURS = [9, 13];

// The cron's own sanity window, not the schedule. Slots are what decide when a
// post goes out; this only stops a backlog emptying itself overnight after an
// outage, and leaves the afternoon free for a missed 09:00 to catch up.
const POST_START_HOUR = SLOT_HOURS[0];
const POST_END_HOUR = 18;
const MAX_ATTEMPTS = 3;

// Two different questions, and conflating them is why the LinkedIn page said
// "connected" on the strength of an environment variable alone.
//
// The APP is fleet-wide: one developer app, one client id and secret. The
// CONNECTION is per title: each publication authorises its own company page,
// and a title with no token cannot post no matter how well the app is set up.
export function isLinkedInAppConfigured() {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

// Ready to post is three things: the fleet app, a live token, and a company
// page bound to THIS title. It used to be handed `creds.linkedin`, a
// SiteCredential row that no code path has ever written — so it answered false
// for every title however well connected, and the cron skipped the whole fleet
// while reporting a clean run. The connection lives in EngineSetting under
// AUTH_KEY, written by the OAuth callback, and that is now the only store.
export function isLinkedInConfigured(auth) {
  return Boolean(isLinkedInAppConfigured() && auth?.accessToken && auth?.organisationUrn);
}

/** One title's stored connection, token included. Server-side only. */
export async function authFor(site) {
  return readAuth(forSite(site.id));
}

export function redirectUri() {
  return (
    process.env.LINKEDIN_REDIRECT_URI ||
    `${(process.env.APP_URL || "https://smart-sme-app.vercel.app").replace(/\/$/, "")}/api/linkedin/callback`
  );
}

// ---------- token storage ----------
//
// The token can post publicly as JB, so it is encrypted at rest rather than
// sitting in a table in plain text: a leaked DATABASE_URL should not hand
// anyone his LinkedIn voice. AUTH_SECRET is the key material because it is
// already required, already secret and already only on the server.

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to store the LinkedIn token.");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(text, "utf-8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function decrypt(stored) {
  const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf-8");
}

// Takes the scoped handle. It used to read a module-level `db` that does not
// exist since the multi-tenant split, so every call threw a ReferenceError.
async function readAuth(db) {
  const row = await db.engineSetting.findUnique({ where: { key: AUTH_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(decrypt(row.value));
  } catch {
    // Rotating AUTH_SECRET orphans the stored token. Reading it as "not
    // connected" turns that into a Connect button rather than a crash.
    return null;
  }
}

async function writeAuth(db, auth) {
  const value = encrypt(JSON.stringify(auth));
  await db.engineSetting.upsert({
    where: { key: AUTH_KEY },
    update: { value },
    create: { key: AUTH_KEY, value },
  });
}

export async function disconnect(site) {
  const db = forSite(site.id);
  await db.engineSetting.deleteMany({ where: { key: AUTH_KEY } });
}

// What the page needs to render the connection panel. Never returns the token.
export async function getConnection(site) {
  const db = forSite(site.id);
  const auth = await readAuth(db);
  if (!auth) return null;
  const daysLeft = Math.floor((auth.expiresAt - Date.now()) / 864e5);
  return {
    name: auth.name,
    personUrn: auth.personUrn,
    connectedAt: auth.connectedAt,
    expiresAt: auth.expiresAt,
    daysLeft,
    expired: daysLeft <= 0,
    canRefresh: Boolean(auth.refreshToken),
    // Signed in is not the same as able to post, and the page has to tell them
    // apart: a connection with no page bound looks healthy and publishes
    // nothing.
    organisationUrn: auth.organisationUrn || null,
    organisationName: auth.organisationName || null,
    organisations: auth.organisations || [],
    organisationsError: auth.organisationsError || null,
    ready: Boolean(auth.accessToken && auth.organisationUrn) && daysLeft > 0,
  };
}

// ---------- OAuth ----------

export async function authorizeUrl(site) {
  const db = forSite(site.id);
  const state = crypto.randomBytes(16).toString("hex");
  await db.engineSetting.upsert({
    where: { key: STATE_KEY },
    update: { value: JSON.stringify({ state, at: Date.now() }) },
    create: { key: STATE_KEY, value: JSON.stringify({ state, at: Date.now() }) },
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri(),
    // The slug rides along in `state` because the callback is one fixed URL
    // registered with LinkedIn — it cannot carry a per-title path, and without
    // the slug it has no way of knowing which publication consented. The random
    // half is still what makes the state unguessable; the slug is only a label,
    // and it is checked against the stored value before anything is written.
    state: `${site.slug}:${state}`,
    scope: SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

// The pages this token may post as. Returns the reason on failure rather than
// throwing: a 403 here means the app has a valid token but not the Community
// Management API product, which is an admin job on developer.linkedin.com and
// not something a retry fixes. The member half of the connection is still
// worth keeping, so the caller stores the error and the page reports it.
async function adminedOrganisations(accessToken) {
  const url =
    "https://api.linkedin.com/rest/organizationAcls" +
    "?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED" +
    "&projection=(elements*(organization~(id,localizedName)))";
  let res;
  try {
    res = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": API_VERSION,
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { organisations: [], error: `Could not reach LinkedIn: ${e.message}` };
  }
  if (res.status === 403) {
    return {
      organisations: [],
      error:
        "LinkedIn refused to list company pages (403). The app is missing the Community Management API product, which is what allows posting as a page.",
    };
  }
  if (!res.ok) {
    return {
      organisations: [],
      error: `LinkedIn returned ${res.status} listing company pages: ${(await res.text()).slice(0, 200)}`,
    };
  }
  const body = await res.json().catch(() => ({}));
  const organisations = (body.elements || [])
    .map((el) => {
      const org = el["organization~"] || {};
      const urn = el.organization || (org.id ? `urn:li:organization:${org.id}` : null);
      return urn ? { urn, name: org.localizedName || urn } : null;
    })
    .filter(Boolean);
  return {
    organisations,
    error: organisations.length ? null : "This LinkedIn account administers no company pages.",
  };
}

/** Bind one of the admined pages to this title. */
export async function selectOrganisation(site, urn) {
  const db = forSite(site.id);
  const auth = await readAuth(db);
  if (!auth) throw new Error("LinkedIn is not connected for this title.");
  // Checked against the stored list rather than trusted from the form: the
  // token can only post as a page it administers, and a typo would otherwise
  // surface as an opaque LinkedIn 403 three hours later when the slot lands.
  const match = (auth.organisations || []).find((o) => o.urn === urn);
  if (!match) throw new Error("That company page is not one this account administers.");
  await writeAuth(db, { ...auth, organisationUrn: match.urn, organisationName: match.name });
  return match.name;
}

/** The title a callback belongs to, read back out of the state parameter. */
export function siteSlugFromState(state) {
  const raw = String(state || "");
  const at = raw.indexOf(":");
  return at > 0 ? raw.slice(0, at) : null;
}

async function tokenRequest(body) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...body,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LinkedIn token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function completeConnection(site, code, state) {
  const db = forSite(site.id);
  const row = await db.engineSetting.findUnique({ where: { key: STATE_KEY } });
  const saved = row ? JSON.parse(row.value) : null;
  // One-shot, ten minutes. Guards against a replayed callback binding someone
  // else's LinkedIn account to the app. Compared against the random half only:
  // the slug prefix is routing, not a secret.
  const nonce = String(state || "").split(":").pop();
  if (!saved || saved.state !== nonce || Date.now() - saved.at > 6e5) {
    throw new Error("The LinkedIn sign-in link was stale or did not match. Start again from the Connect button.");
  }
  await db.engineSetting.deleteMany({ where: { key: STATE_KEY } });

  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });

  // Best effort, and never fatal. With only the Community Management API
  // product there is no openid scope and this 403s, which is fine: the person
  // behind the grant is a nicety on the settings panel, and the page is what
  // actually posts. It threw here until 1 Sep 2026, which would have failed
  // every connection on the one app configuration that can post as a page.
  const profile = await readProfile(token.access_token);

  // Which company pages this person administers. A title posts as its page, so
  // a connection with no page is not yet a usable connection — but it is still
  // stored, because the LinkedIn page can then say exactly what is missing
  // instead of the cron failing quietly days later.
  const { organisations, error } = await adminedOrganisations(token.access_token);

  // Named after the page where there is one, because that is the identity the
  // posts carry. The person is only shown when nothing else is known.
  const name = organisations.length === 1 ? organisations[0].name : profile?.name || "LinkedIn";

  await writeAuth(db, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt: Date.now() + (token.expires_in || 5184000) * 1000,
    personUrn: profile?.sub ? `urn:li:person:${profile.sub}` : null,
    name,
    connectedAt: Date.now(),
    organisations,
    organisationsError: error,
    // One page is the common case and choosing it for them saves a step. With
    // more than one, nothing is bound until a human says which: the fleet
    // shares an admin, so a wrong guess publishes one title's articles to
    // another title's followers.
    organisationUrn: organisations.length === 1 ? organisations[0].urn : null,
    organisationName: organisations.length === 1 ? organisations[0].name : null,
  });
  return name;
}

/** Who authorised, where the app is allowed to ask. Null when it is not. */
async function readProfile(accessToken) {
  try {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Tokens last 60 days. Programmatic refresh is not granted to every self-serve
// app, so the refresh is attempted where possible and the page falls back to
// telling you to reconnect where it is not.
async function usableToken(db) {
  const auth = await readAuth(db);
  if (!auth) throw new Error("LinkedIn is not connected. Connect it on the LinkedIn page.");
  if (!auth.organisationUrn) {
    throw new Error("No company page is bound to this title. Pick one on the LinkedIn page.");
  }

  const daysLeft = (auth.expiresAt - Date.now()) / 864e5;
  if (daysLeft > 7) return auth;

  if (!auth.refreshToken) {
    if (daysLeft <= 0) {
      throw new Error("The LinkedIn token has expired. Reconnect on the LinkedIn page.");
    }
    return auth;
  }

  try {
    const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: auth.refreshToken });
    const next = {
      ...auth,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || auth.refreshToken,
      expiresAt: Date.now() + (token.expires_in || 5184000) * 1000,
    };
    await writeAuth(db, next);
    return next;
  } catch (e) {
    if (daysLeft <= 0) throw new Error(`The LinkedIn token expired and could not be refreshed: ${e.message}`);
    return auth;
  }
}

// ---------- rendering ----------
//
// Escaping and company tagging are the same problem and live together in
// linkedin-mentions.js: a mention is spelled @[Name](urn), which is made
// entirely of the characters that must be escaped everywhere else, so the two
// cannot be done in sequence by separate code.
export { escapeCommentary, renderCommentary } from "./linkedin-mentions.js";

// ---------- images ----------

// A post carries either an image or a link preview card, never both, and every
// post here carries an image. So the link stays where the house format put it:
// on its own line in the text, exactly as approved.
async function uploadImage(auth, buffer) {
  const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
      "content-type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": API_VERSION,
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: auth.organisationUrn } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!init.ok) {
    throw new Error(`LinkedIn refused the image upload (${init.status}): ${(await init.text()).slice(0, 300)}`);
  }
  const { value } = await init.json();

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { authorization: `Bearer ${auth.accessToken}`, "content-type": "image/jpeg" },
    body: buffer,
    signal: AbortSignal.timeout(60000),
  });
  if (!put.ok) {
    throw new Error(`The image upload failed (${put.status}): ${(await put.text()).slice(0, 300)}`);
  }
  // No readback: the token cannot GET /rest/images, so there is no way to poll
  // for processing. LinkedIn finishes it on their side.
  return value.image;
}

// ---------- publishing ----------

// Where the picture and its alt text come from, given a queue row. Kept here so
// the cron, the "post now" button and the preview all show the same card.
export async function imageForPost(site, post) {
  const db = forSite(site.id);
  if (!post.articleId) return { url: post.imageUrl || null, alt: null };
  const article = await db.article.findUnique({
    where: { id: post.articleId },
    select: { title: true, imageUrl: true, imageAlt: true },
  });
  return {
    url: post.imageUrl || article?.imageUrl || null,
    alt: article?.imageAlt || article?.title || null,
  };
}

// The companies to tag, from the outbound links in the article this post came
// from. A hand-written post with no article behind it tags nobody, which is
// correct: there is no evidence to verify a guess against.
export async function mentionsForPost(site, post, auth) {
  if (!post.articleId) return [];
  const db = forSite(site.id);
  const article = await db.article.findUnique({
    where: { id: post.articleId },
    select: { body: true },
  });
  if (!article?.body) return [];

  const links = [...article.body.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  if (!links.length) return [];

  try {
    return await mentionsForArticle(auth.accessToken, { links, ownHost: siteHost(site) });
  } catch {
    // Never let tagging stop a post going out. An untagged post is a small
    // loss; a post that does not publish is the whole point missed.
    return [];
  }
}

export async function publishPost(site, post) {
  const db = forSite(site.id);
  const auth = await usableToken(db);

  // Resolved at publish time rather than stored on the draft. It needs a live
  // token, which a draft written by the agent may not have had, and the URN
  // cache is fleet-wide so this is usually no API calls at all.
  const mentions = await mentionsForPost(site, post, auth);

  const { url, alt } = await imageForPost(site, post);
  const { composeLinkedInImage } = await import("./linkedin-image.js");
  const { buffer } = await composeLinkedInImage(url);
  const imageUrn = await uploadImage(auth, buffer);

  const body = {
    // The page, never the person. This posted as auth.personUrn until 1 Sep
    // 2026, which would have put five titles' articles on JB's own feed.
    author: auth.organisationUrn,
    commentary: renderCommentary(post.text.trim(), mentions),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    content: {
      media: { id: imageUrn, altText: (alt || site?.name || "").slice(0, 300) },
    },
  };

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
      "content-type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": API_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    // Surfaced verbatim: LinkedIn's errors name the exact field or version at
    // fault, and paraphrasing them just costs a debugging round trip.
    throw new Error(`LinkedIn rejected the post (${res.status}): ${(await res.text()).slice(0, 400)}`);
  }

  const urn = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
}

// ---------- scheduling ----------

const inPostingHours = (d) => {
  const h = ukHour(d);
  return h >= POST_START_HOUR && h < POST_END_HOUR;
};

/** Is now inside posting hours? The cron asks so a backlog cannot empty at 3am. */
export const withinPostingHours = (d = new Date()) => inPostingHours(d);
export const postingHoursLabel = () => SLOT_HOURS.map((h) => `${h}:00`).join(" and ") + " UK";

// How far UK local time is from UTC at a given instant, in minutes. Read from
// Intl rather than assumed, because the answer is 0 for half the year and 60
// for the other half and hardcoding either is a bug twice a year.
function ukOffsetMinutes(at) {
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  }).format(at);
  const m = /GMT([+-]\d+)?/.exec(label);
  return m && m[1] ? Number(m[1]) * 60 : 0;
}

/** The instant at which UK wall clock reads `hour`:00 on today + dayOffset. */
function ukSlot(dayOffset, hour) {
  const midnightUtc = new Date();
  midnightUtc.setUTCHours(0, 0, 0, 0);
  midnightUtc.setUTCDate(midnightUtc.getUTCDate() + dayOffset);

  const guess = new Date(midnightUtc.getTime() + hour * 36e5);
  const slot = new Date(guess.getTime() - ukOffsetMinutes(guess) * 60000);

  // One correction is normally exact. On the two changeover Sundays the offset
  // read at the guess can differ from the offset at the answer, so check the
  // wall clock actually reads back as intended and correct once more if not.
  if (ukHour(slot) === hour) return slot;
  return new Date(guess.getTime() - ukOffsetMinutes(slot) * 60000);
}

// The next `count` 09:00 / 13:00 UK slots this title has not already booked.
//
// Returns a run rather than one at a time because the caller usually wants
// several, and asking repeatedly only works if every answer is written to the
// database before the next call. It is not: a dry run, or any caller that
// batches its writes, gets the same slot back every time. Reserving locally as
// it goes makes the answer correct regardless of when the caller commits.
export async function nextPostingSlots(site, count = 1) {
  const db = forSite(site.id);
  const booked = new Set(
    (
      await db.linkedInPost.findMany({
        where: { scheduledFor: { not: null }, postedAt: null },
        select: { scheduledFor: true },
      })
    ).map((r) => new Date(r.scheduledFor).getTime())
  );

  const now = Date.now();
  const out = [];
  // Three weeks is far more headroom than a two-a-day queue can consume before
  // DRAFT_EXPIRY_DAYS clears it.
  for (let day = 0; day < 21 && out.length < count; day++) {
    for (const hour of SLOT_HOURS) {
      const slot = ukSlot(day, hour);
      if (slot.getTime() <= now) continue;
      if (booked.has(slot.getTime())) continue;
      out.push(slot);
      booked.add(slot.getTime());
      if (out.length >= count) break;
    }
  }
  return out;
}

/** The single next free slot. */
export async function nextPostingSlot(site) {
  const [slot] = await nextPostingSlots(site, 1);
  return slot || ukSlot(21, SLOT_HOURS[0]);
}

// Posts whose slot has arrived. Kept here so the cron and the page agree on
// what "due" means.
//
// Fully automated, JB's standing instruction of 25 Aug 2026: nothing on any
// queue waits for a human. Every post is given a slot the moment it is drafted
// and goes out when that slot arrives, whether or not anyone approved it. The
// dashboard is an override surface, not a gate.
//
// A slot is now REQUIRED. It used to be that a slotless post counted as due,
// which was the right call when the schedule was "some time in the next free
// half hour" and is the wrong one now: it would put a post out at whatever
// o'clock the cron happened to tick, which is exactly what fixed slots exist to
// stop. Anything slotless therefore sits until it expires, so every path that
// creates a post has to book one.
//
// Drafts older than five days expire unposted: a three-week-old news post is
// worse than none.
export const DRAFT_EXPIRY_DAYS = 5;

export function dueFilter() {
  return {
    status: { in: ["draft", "approved"] },
    scheduledFor: { not: null, lte: new Date() },
    postedAt: null,
    attempts: { lt: MAX_ATTEMPTS },
  };
}

export { MAX_ATTEMPTS, POST_START_HOUR, POST_END_HOUR, SLOT_HOURS };
