import { prisma } from "./prisma";
import { runDays } from "./ads";
import { ukDay } from "./campaigns";

// The paid banner in the weekly newsletter (position newsletter_banner).
//
// Booked by the month ("one weekly newsletter banner per month", as Miele's
// 2027 plan has it), so the first issue on or after the booking's start date,
// within its month, carries it; once an issue has, the placement records that
// issue's Mailchimp id and is not carried again. Setting the start date to a
// particular Thursday picks that week instead.
//
// The image and the click both go through the title's own site, never the
// incubator: the image from the copy the ad plugin keeps in uploads (public,
// cached, on the sender's domain) and the click through the plugin's
// /cogent/v1/ads/go, which counts it and forwards to the client's page. An
// image that does not answer is left out rather than sent broken.

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/** Returns { html, deliverableId } for this issue, or null. */
export async function newsletterBanner(site, siteBase, { campaign, now = new Date() } = {}) {
  if (!siteBase) return null;
  const today = ukDay(now);
  const due = await prisma.campaignDeliverable.findMany({
    where: {
      siteId: site.id,
      position: "newsletter_banner",
      paused: false,
      mailchimpCampaignId: null,
      status: { not: "cancelled" },
      campaign: { status: { not: "cancelled" } },
      dueDate: { lte: now },
    },
    include: {
      campaign: { select: { advertiser: { select: { company: true } } } },
      assets: { where: { active: true, webData: { not: null } }, select: { id: true, webMime: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { dueDate: "asc" },
  });
  // Still within the month it was booked for: a banner that missed its month
  // (newsletter off that week, say) is not quietly run the month after.
  const d = due.find((x) => {
    const run = runDays(x);
    return run && today <= run.end && x.targetUrl && x.assets.length;
  });
  if (!d) return null;

  const a = d.assets[0];
  const img = `${siteBase}/wp-content/uploads/cogent-ads/${a.id}.${EXT[a.webMime] || "png"}`;
  try {
    const res = await fetch(img, { method: "HEAD", signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return { skipped: `banner image not on the site yet (${res.status}): ${img}` };
  } catch (e) {
    return { skipped: `banner image unreachable: ${String(e.message || e).slice(0, 80)}` };
  }

  const go = new URL(`${siteBase}/wp-json/cogent/v1/ads/go`);
  go.searchParams.set("ad", d.id);
  go.searchParams.set("cr", a.id);
  // Not read by the redirect: the newsletter refuses any link without them.
  go.searchParams.set("utm_source", "newsletter");
  go.searchParams.set("utm_medium", "email");
  if (campaign) go.searchParams.set("utm_campaign", campaign);
  const href = esc(go.toString());
  const alt = esc(d.campaign.advertiser.company);

  const html =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr><td style="padding:22px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8f98;text-align:center;">Advertisement</td></tr>` +
    `<tr><td align="center" style="padding:0 0 10px;"><a href="${href}" target="_blank" style="text-decoration:none;">` +
    `<img src="${esc(img)}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;" /></a></td></tr>` +
    `</table>`;
  return { html, deliverableId: d.id };
}

/** Record which issue carried the banner, so it is not carried twice and its opens can be read. */
export async function markCarried(deliverableId, mailchimpCampaignId) {
  if (!deliverableId || !mailchimpCampaignId) return;
  await prisma.campaignDeliverable.update({
    where: { id: deliverableId },
    data: { mailchimpCampaignId, status: "delivered", deliveredAt: new Date() },
  });
}
