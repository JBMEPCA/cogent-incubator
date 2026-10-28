/**
 * The Make.com bridge: LinkedIn and Instagram posting without our own API
 * approval.
 *
 * LinkedIn's Community Management API review for app 266128203 sat in "Access
 * Form Review" from 2 September 2026 past its own stated 10-14 business days,
 * and no title could post. Make.com already holds LinkedIn's and Meta's
 * approval to post to pages its users connect, so on 22 September JB chose to
 * route through it: the engine sends each finished post to one Make webhook,
 * and a Make scenario routes it to the right LinkedIn page or Instagram account.
 *
 * What the bridge cannot do is tag companies in a LinkedIn post; that needs our
 * own approved app. When LinkedIn approves it, a title with a direct connection
 * posts directly again and the bridge is simply not used for it.
 *
 * Switched on per title AND per network, so a page is only posted to once JB
 * has connected it in Make:
 *   GlobalSetting  make_webhook_url         the scenario's webhook address
 *   EngineSetting  social_bridge            {"linkedin":true,"instagram":true}
 */

import { prisma, forSite } from "./prisma.js";

const WEBHOOK_KEY = "make_webhook_url";
const LOOKUP_KEY = "make_lookup_url";
const BRIDGE_KEY = "social_bridge";

/** Both settings must point at a Make hook; anything else is a misconfiguration. */
const isMakeHook = (url) => Boolean(url) && /^https:\/\/hook\.[a-z0-9.-]*make\.com\//i.test(url);

export async function bridgeWebhook() {
  const row = await prisma.globalSetting.findUnique({ where: { key: WEBHOOK_KEY } });
  const url = row?.value?.trim();
  return isMakeHook(url) ? url : null;
}

/**
 * Resolve a LinkedIn vanity name to an organisation, through Make.
 *
 * We hold no LinkedIn token of our own while app 266128203 is in review, but
 * Make's connection can call the API, and organizations?q=vanityName is not
 * admin-gated. So Make answers "here is the org with this name" and nothing
 * else: whether that org may be tagged is decided by the website check in
 * lib/linkedin-mentions.js, which stays our side.
 *
 * The scenario is a Custom webhook -> LinkedIn Make an API Call -> Webhook
 * response, and it must return LinkedIn's body unchanged, elements array and
 * all. Null on anything unexpected, because an untagged post is a far better
 * outcome than a post that does not go out.
 */
export async function lookupOrganisation(vanityName) {
  const row = await prisma.globalSetting.findUnique({ where: { key: LOOKUP_KEY } });
  const url = row?.value?.trim();
  if (!isMakeHook(url)) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vanityName }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body?.elements?.[0] || null;
  } catch {
    return null;
  }
}

/** Which networks this title posts to through Make. */
export async function bridgeFor(site) {
  const row = await forSite(site.id).engineSetting.findUnique({ where: { key: BRIDGE_KEY } });
  try {
    return { linkedin: false, instagram: false, tagging: false, ...JSON.parse(row?.value || "{}") };
  } catch {
    return { linkedin: false, instagram: false, tagging: false };
  }
}

export async function bridgeReady(site, network) {
  if (!(await bridgeWebhook())) return false;
  return Boolean((await bridgeFor(site))[network]);
}

/**
 * A public JPEG of an article picture, at the size the network wants.
 *
 * Instagram accepts JPEG only, and between 4:5 and 1.91:1. WordPress serves
 * whatever was uploaded (PNG, WebP, any shape), so the picture goes through a
 * resizing proxy that crops and converts it. The source must be public, which
 * every published featured image is.
 */
//
// The crop follows the website's face rule (lib/lead-crop.js): a centre crop,
// moved only where the centre would cut the top off a head. It used wsrv's
// "attention" crop until 28 Oct 2026, which keeps whatever is most colourful,
// and on the Echoes / Fleet Agent post that was a polka-dot tie, so LinkedIn
// showed a man from the nose down. The picture is read once here to find the
// head; if it cannot be read, the centre crop goes out, never attention.
export async function socialImage(url, { width, height }) {
  if (!url) return null;
  const bare = String(url).replace(/^https?:\/\//, "");
  let window = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const { faceSafeWindow } = await import("./lead-crop.js");
      window = await faceSafeWindow(Buffer.from(await res.arrayBuffer()), width / height);
    }
  } catch {
    window = null;
  }
  const base = `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=${width}&h=${height}`;
  if (window?.pad) return `${base}&fit=contain&cbg=${window.background}&output=jpg&q=85`;
  // precrop applies the window to the original's pixels before the resize.
  const crop = window ? `&cx=${window.left}&cy=${window.top}&cw=${window.width}&ch=${window.height}&precrop` : "";
  return `${base}${crop}&fit=cover&output=jpg&q=85`;
}

/**
 * Hand one post to Make. Throws on anything but a 2xx, so the caller records a
 * failure rather than a post that never happened.
 *
 * Make answers "Accepted" the moment the webhook queues the data, so success
 * here means Make has it, not that LinkedIn or Instagram published it. Make
 * keeps its own run history with the network's answer for anything it could
 * not post.
 */
export async function sendToBridge(site, payload) {
  const url = await bridgeWebhook();
  if (!url) throw new Error("Make webhook not set (GlobalSetting make_webhook_url)");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: site.slug, titleName: site.name, ...payload }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Make webhook refused the post (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { id: `make:${payload.destination}:${Date.now()}` };
}
