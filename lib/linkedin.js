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
//   1. developer.linkedin.com -> create an app against the Smart SME page
//   2. Products tab -> add "Sign In with LinkedIn using OpenID Connect"
//      and "Share on LinkedIn". Both are self-serve, no review queue.
//   3. Auth tab -> add the redirect URL below
//   4. LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET into .env and Vercel
//   5. Click Connect on /linkedin
import crypto from "crypto";
import { forSite } from "./prisma";
import { ukHour } from "./agents/hours";

const AUTH_KEY = "linkedin:auth";
const STATE_KEY = "linkedin:oauthState";

// Versions are supported for at least a year from release; 202607 was current
// when this was built. If LinkedIn sunsets it the API returns a 426 naming the
// valid versions, so bump this (or LINKEDIN_API_VERSION) and redeploy.
const API_VERSION = process.env.LINKEDIN_API_VERSION || "202607";

// Posting hours are deliberately tighter than the agents' working day: a post
// landing at 07:00 or 19:30 gets seen by nobody.
const POST_START_HOUR = 8;
const POST_END_HOUR = 18;
const MIN_GAP_HOURS = 3;
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

export function isLinkedInConfigured(linkedin) {
  return Boolean(isLinkedInAppConfigured() && linkedin?.accessToken && linkedin?.organisationUrn);
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
    scope: "openid profile w_member_social",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
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

  const who = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!who.ok) throw new Error(`Could not read the LinkedIn profile (${who.status}): ${(await who.text()).slice(0, 300)}`);
  const profile = await who.json();

  await writeAuth(db, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt: Date.now() + (token.expires_in || 5184000) * 1000,
    personUrn: `urn:li:person:${profile.sub}`,
    name: profile.name || "LinkedIn",
    connectedAt: Date.now(),
  });
  return profile.name;
}

// Tokens last 60 days. Programmatic refresh is not granted to every self-serve
// app, so the refresh is attempted where possible and the page falls back to
// telling you to reconnect where it is not.
async function usableToken(db) {
  const auth = await readAuth(db);
  if (!auth) throw new Error("LinkedIn is not connected. Connect it on the LinkedIn page.");

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

// LinkedIn's commentary field is a light markup format, and any reserved
// character left unescaped is not merely shown wrong: an unescaped "(" silently
// truncates the post from that point on. "#" is deliberately left alone so
// hashtags stay hashtags.
export function escapeCommentary(text) {
  return text.replace(/[\\|{}@\[\]()<>*_~]/g, (c) => `\\${c}`);
}

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
    body: JSON.stringify({ initializeUploadRequest: { owner: auth.personUrn } }),
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
  // No readback: a w_member_social token cannot GET /rest/images, so there is
  // no way to poll for processing. LinkedIn finishes it on their side.
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

export async function publishPost(site, post) {
  const db = forSite(site.id);
  const auth = await usableToken(db);

  const { url, alt } = await imageForPost(site, post);
  const { composeLinkedInImage } = await import("./linkedin-image.js");
  const { buffer } = await composeLinkedInImage(url);
  const imageUrn = await uploadImage(auth, buffer);

  const body = {
    author: auth.personUrn,
    commentary: escapeCommentary(post.text.trim()),
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
export const postingHoursLabel = () => `${POST_START_HOUR}:00-${POST_END_HOUR}:00 UK`;

// Next free slot: at least MIN_GAP_HOURS after whatever is already booked, and
// inside posting hours. Walked in half-hour steps against UK wall clock so it
// stays right either side of the BST switch without a date library.
export async function nextPostingSlot(site) {
  const db = forSite(site.id);
  const last = await db.linkedInPost.findFirst({
    where: { OR: [{ status: "approved", scheduledFor: { not: null } }, { status: "posted" }] },
    orderBy: [{ scheduledFor: "desc" }],
    select: { scheduledFor: true, postedAt: true },
  });

  const busyUntil = last?.scheduledFor || last?.postedAt;
  let t = Math.max(Date.now(), busyUntil ? new Date(busyUntil).getTime() + MIN_GAP_HOURS * 36e5 : 0);
  t = Math.ceil(t / 18e5) * 18e5; // round up to the next half hour

  // A week of half-hour steps is far more headroom than a two-a-day queue needs.
  for (let i = 0; i < 336; i++) {
    const candidate = new Date(t);
    if (inPostingHours(candidate)) return candidate;
    t += 18e5;
  }
  return new Date(t);
}

// Posts whose slot has arrived. Kept here so the cron and the page agree on
// what "due" means.
// Fully automated posting, JB's standing instruction of 25 Aug 2026: nothing
// on any queue may wait for a human. A draft gets a two-hour override window -
// the same shape as outreach, where the dashboard is an override surface, not
// an approval gate - then posts itself. Approving in the UI just skips the
// window. Drafts older than five days expire unposted: a three-week-old news
// post is worse than none, and Smart SME had six drafts from 2 August still
// "awaiting approval" on the day this changed.
const AUTO_POST_AFTER_HOURS = 2;
export const DRAFT_EXPIRY_DAYS = 5;

export function dueFilter() {
  const windowAgo = new Date(Date.now() - AUTO_POST_AFTER_HOURS * 36e5);
  return {
    OR: [
      // An approved post still honours its booked slot; a slotless one is due.
      { status: "approved", OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
      // A draft posts itself once its override window has passed, at its slot
      // if it has one.
      {
        status: "draft",
        createdAt: { lte: windowAgo },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
    ],
    postedAt: null,
    attempts: { lt: MAX_ATTEMPTS },
  };
}

export { MAX_ATTEMPTS, POST_START_HOUR, POST_END_HOUR };
