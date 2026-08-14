import crypto from "crypto";
import fs from "fs";

// Server-only Google service-account auth. Signs the OAuth JWT with node:crypto
// rather than pulling in the whole googleapis client — all we ever need is
// "give me an access token".
//
// The key can arrive three ways, checked in this order:
//   GOOGLE_SERVICE_ACCOUNT_JSON       raw JSON or base64 (what Vercel gets)
//   GOOGLE_SERVICE_ACCOUNT_JSON_PATH  path to the key file (what .env uses locally)
// Base64 is the safe form for env UIs, which tend to mangle the private key's
// newlines.

let cachedAccount;

function loadServiceAccount() {
  if (cachedAccount !== undefined) return cachedAccount;

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  let text = null;

  if (inline) {
    const raw = inline.trim();
    text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  } else if (path) {
    try {
      text = fs.readFileSync(path, "utf-8");
    } catch {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON_PATH points at ${path}, which could not be read. On Vercel set GOOGLE_SERVICE_ACCOUNT_JSON (base64) instead — the key file is gitignored and never deployed.`
      );
    }
  }

  if (!text) {
    cachedAccount = null;
    return null;
  }

  const sa = JSON.parse(text);
  if (!sa.client_email || !sa.private_key) {
    throw new Error("The Google service-account key is missing client_email/private_key.");
  }
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  cachedAccount = sa;
  return sa;
}

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// One token per scope-set, cached until shortly before expiry — tokens last an
// hour and a single page render makes a dozen API calls off the same one.
const tokenCache = new Map();

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH
  );
}

export function googleServiceAccountEmail() {
  try {
    return loadServiceAccount()?.client_email || null;
  } catch {
    return null;
  }
}

// `subject` requests a domain-wide-delegation token: the service account acts
// AS that Workspace user rather than as itself. Reporting APIs never need it
// (they grant the service account access directly), but Gmail has no concept of
// a service account owning a mailbox, so sending mail is only possible this way.
export async function getGoogleAccessToken(scopes, subject) {
  const sa = loadServiceAccount();
  if (!sa) throw new Error("No Google service-account key configured.");

  const scopeKey = scopes.join(" ");
  // Impersonated tokens are per-user, so the cache key has to be too — sharing
  // one entry across subjects would hand one mailbox's token to another.
  const cacheKey = subject ? `${subject}\n${scopeKey}` : scopeKey;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      ...(subject ? { sub: subject } : {}),
      scope: scopeKey,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer
    .sign(sa.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    // `unauthorized_client` on an impersonated request means one specific thing,
    // and Google's own message does not say it: the delegation has not been
    // authorised in Admin. Saying so here saves an afternoon.
    if (subject && body.error === "unauthorized_client") {
      throw new Error(
        `Google refused to let the service account act as ${subject}. In Google Admin → Security → Access and data control → API controls → Domain-wide delegation, add client ID ${loadServiceAccount()?.client_id || "(the key's client_id)"} with scope ${scopeKey}.`
      );
    }
    throw new Error(
      `Google token exchange failed (${res.status}): ${body.error_description || body.error || "no access_token"}`
    );
  }
  tokenCache.set(cacheKey, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
  });
  return body.access_token;
}

export async function googleGet(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(explainGoogleError(res.status, body));
  return body;
}

export async function googlePost(token, url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(explainGoogleError(res.status, body));
  return body;
}

// Google's permission errors are famously unhelpful ("User does not have
// sufficient permission"), and the fix is always the same one manual step.
function explainGoogleError(status, body) {
  const msg = body?.error?.message || body?.error_description || "request failed";
  const email = googleServiceAccountEmail();
  if (status === 403 && email) {
    return `${msg} — grant ${email} access to this property (Search Console: Settings → Users and permissions; GA4: Admin → Property access management, Viewer is enough).`;
  }
  return `${status}: ${msg}`;
}
