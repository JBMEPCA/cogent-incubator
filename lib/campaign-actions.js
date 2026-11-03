"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { auth } from "./auth";
import { requireEditor } from "./permissions";
import { elementLabel, fromDateInput, ukDay, monthlySchedule, toPence } from "./campaigns";
import { checkCreative, positionInfo, productFor } from "./ad-positions";
// sharp (and ad-creative, which uses it) is loaded inside the actions that
// handle artwork, never at the top. This module is imported by every campaign
// page for its form actions, and on Vercel sharp's native library is only
// traced into routes listed in next.config.mjs: a top-level import made the
// whole campaign page fail to open (3 Nov 2026), not just the upload.
const imaging = () => Promise.all([import("sharp"), import("./ad-creative")]).then(([s, c]) => ({ sharp: s.default, makeWebCopy: c.makeWebCopy }));
import { bookingsMap, pullSiteStats, refreshSites } from "./ads";

// Booked campaigns (see Campaign in the schema). Fleet-wide, so nothing here
// takes a bound site; titles come from the form and are checked against the
// Site table rather than trusted, as on the advertiser list.

const LIST = "/campaigns";
const detail = (id) => `/campaigns/${id}`;
const text = (fd, k) => fd.get(k)?.toString().trim() || "";
const orNull = (v) => (v === "" ? null : v);
const int = (fd, k) => {
  const v = text(fd, k).replace(/[,\s]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const PRODUCTS = new Set(["banner", "solus", "web_story", "newsletter", "multiple", "other"]);
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const CAMPAIGN = ["booked", "live", "complete", "cancelled"];
const DELIVERABLE = ["planned", "awaiting_assets", "in_production", "live", "delivered", "cancelled"];
const PAYMENT = ["expected", "invoiced", "paid"];
const SOURCES = ["manual", "ga4", "mailchimp", "client"];
// Just under the 4 MB server action limit in next.config.mjs, leaving room
// for the rest of the form.
const MAX_FILE = 3.8 * 1024 * 1024;

/** "All titles" is stored as an empty list, as on the Black Book. */
async function readTitles(fd) {
  if (fd.get("allTitles") === "on") return [];
  const picked = fd.getAll("siteIds").map(String);
  if (!picked.length) return [];
  const rows = await prisma.site.findMany({ where: { id: { in: picked } }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function siteOrNull(fd) {
  const id = text(fd, "siteId");
  if (!id) return null;
  return (await prisma.site.findUnique({ where: { id }, select: { id: true } }))?.id || null;
}

/** A deliverable id from the form, only if it belongs to this campaign. */
async function deliverableOf(campaignId, fd) {
  const id = text(fd, "deliverableId");
  if (!id) return null;
  const d = await prisma.campaignDeliverable.findFirst({ where: { id, campaignId }, select: { id: true } });
  return d?.id || null;
}

function campaignFields(fd) {
  return {
    name: text(fd, "name"),
    status: pick(text(fd, "status"), CAMPAIGN, "booked"),
    bookedBy: orNull(text(fd, "bookedBy")),
    clientContact: orNull(text(fd, "clientContact")),
    startDate: fromDateInput(fd.get("startDate")),
    endDate: fromDateInput(fd.get("endDate")),
    valuePence: toPence(fd.get("value")) ?? 0,
    specMd: orNull(text(fd, "specMd")),
    notes: orNull(text(fd, "notes")),
  };
}

// ---------- campaigns

/**
 * The elements added on the booking form, sent as one JSON field. Each needs a
 * type; one with no name is named from its type and title ("Web banner,
 * Nursery Daily") so the attention list never shows a blank row.
 */
async function readElements(fd) {
  let raw;
  try {
    raw = JSON.parse(fd.get("elements") || "[]");
  } catch {
    return { error: "The elements didn't come through. Reload the page and try again." };
  }
  if (!Array.isArray(raw)) return { rows: [] };
  if (raw.some((e) => !PRODUCTS.has(e?.product))) return { error: "Pick a type for every element." };
  const ids = [...new Set(raw.map((e) => e.siteId).filter(Boolean).map(String))];
  const known = new Map(
    (await prisma.site.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((s) => [s.id, s.name])
  );
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  return {
    rows: raw.slice(0, 50).map((e) => {
      const siteId = known.has(e.siteId) ? e.siteId : null;
      return {
        product: e.product,
        siteId,
        title: str(e.title) || [elementLabel(e.product), siteId && known.get(siteId)].filter(Boolean).join(", "),
        spec: str(e.spec) || null,
        assetsDue: fromDateInput(e.assetsDue),
        dueDate: fromDateInput(e.dueDate),
        runUntil: e.product === "banner" ? fromDateInput(e.runUntil) : null,
        status: e.assetsDue ? "awaiting_assets" : "planned",
      };
    }),
  };
}

/** Returns { ok, message } when the form is short of something; redirects to the new campaign otherwise. */
export async function createCampaign(_prev, fd) {
  await requireEditor();
  const advertiserId = text(fd, "advertiserId");
  const adv = advertiserId && (await prisma.advertiser.findUnique({ where: { id: advertiserId }, select: { id: true } }));
  const data = campaignFields(fd);
  if (!adv) return { ok: false, message: "Pick the advertiser from the list. A brand not on it yet is added on the Advertisers tab." };
  if (!data.name) return { ok: false, message: "Give the campaign a name." };

  const elements = await readElements(fd);
  if (elements.error) return { ok: false, message: elements.error };

  const payMode = text(fd, "payMode");
  let payments = [];
  if (payMode === "monthly" || payMode === "single") {
    if (!data.valuePence) return { ok: false, message: "Enter the total value to set up payments, or pick Set up later." };
    if (payMode === "monthly") {
      const months = int(fd, "months") || 12;
      const first = fromDateInput(fd.get("firstDue")) || data.startDate || fromDateInput(ukDay(new Date()));
      payments = monthlySchedule(data.valuePence, first, months);
    } else {
      const due = fromDateInput(fd.get("payDate")) || data.startDate;
      if (!due) return { ok: false, message: "Give the payment a due date." };
      payments = [{ amountPence: data.valuePence, dueDate: due }];
    }
  }

  const c = await prisma.campaign.create({
    data: {
      ...data,
      advertiserId: adv.id,
      siteIds: await readTitles(fd),
      deliverables: { create: elements.rows },
      payments: { create: payments },
    },
  });
  revalidatePath(LIST);
  redirect(detail(c.id));
}

export async function updateCampaign(id, fd) {
  await requireEditor();
  const data = campaignFields(fd);
  if (!data.name) return;
  await prisma.campaign.update({ where: { id: String(id) }, data: { ...data, siteIds: await readTitles(fd) } });
  revalidatePath(LIST);
  revalidatePath(detail(id));
}

export async function deleteCampaign(id) {
  await requireEditor();
  await prisma.campaign.delete({ where: { id: String(id) } });
  revalidatePath(LIST);
  redirect(LIST);
}

// ---------- deliverables

function deliverableFields(fd) {
  const product = text(fd, "product");
  return {
    title: text(fd, "title"),
    product: PRODUCTS.has(product) ? product : null,
    spec: orNull(text(fd, "spec")),
    assetsDue: fromDateInput(fd.get("assetsDue")),
    dueDate: fromDateInput(fd.get("dueDate")),
    runUntil: fromDateInput(fd.get("runUntil")),
    notes: orNull(text(fd, "notes")),
  };
}

export async function addDeliverable(campaignId, fd) {
  await requireEditor();
  const data = deliverableFields(fd);
  if (!data.product) return;
  const siteId = await siteOrNull(fd);
  // Named from its type and title when left blank, as on the booking form.
  const site = siteId && (await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }));
  await prisma.campaignDeliverable.create({
    data: {
      ...data,
      title: data.title || [elementLabel(data.product), site?.name].filter(Boolean).join(", "),
      status: data.assetsDue ? "awaiting_assets" : "planned",
      campaignId: String(campaignId),
      siteId,
    },
  });
  revalidatePath(detail(campaignId));
  revalidatePath(LIST);
}

export async function updateDeliverable(id, fd) {
  await requireEditor();
  const d = await prisma.campaignDeliverable.findUnique({ where: { id: String(id) } });
  if (!d) return;
  const data = deliverableFields(fd);
  const status = pick(text(fd, "status"), DELIVERABLE, d.status);
  // The day it went out is kept the first time it is marked live or
  // delivered, so a later edit does not move it.
  const out = status === "live" || status === "delivered";
  await prisma.campaignDeliverable.update({
    where: { id: d.id },
    data: {
      ...data,
      title: data.title || d.title,
      status,
      siteId: await siteOrNull(fd),
      liveUrl: orNull(text(fd, "liveUrl")),
      deliveredAt: out ? d.deliveredAt || new Date() : null,
    },
  });
  revalidatePath(detail(d.campaignId));
  revalidatePath(LIST);
}

export async function deleteDeliverable(id) {
  await requireEditor();
  const d = await prisma.campaignDeliverable.delete({ where: { id: String(id) } });
  revalidatePath(detail(d.campaignId));
  revalidatePath(LIST);
  // A deleted placement must come off the site now, not at the next refresh.
  if (d.position && d.siteId) await Promise.race([refreshSites([d.siteId]), new Promise((r) => setTimeout(r, 4000))]);
}

// ---------- payments

export async function addPayment(campaignId, fd) {
  await requireEditor();
  const amountPence = toPence(fd.get("amount"));
  const dueDate = fromDateInput(fd.get("dueDate"));
  if (!amountPence || !dueDate) return;
  await prisma.campaignPayment.create({
    data: {
      campaignId: String(campaignId),
      amountPence,
      dueDate,
      status: pick(text(fd, "status"), PAYMENT, "expected"),
      invoiceRef: orNull(text(fd, "invoiceRef")),
      notes: orNull(text(fd, "notes")),
    },
  });
  revalidatePath(detail(campaignId));
  revalidatePath(LIST);
}

/** Lay out a total as equal monthly instalments in one go. */
export async function schedulePayments(campaignId, fd) {
  await requireEditor();
  const total = toPence(fd.get("total"));
  const first = fromDateInput(fd.get("firstDue"));
  const months = int(fd, "months");
  if (!total || !first || !months) return;
  await prisma.campaignPayment.createMany({
    data: monthlySchedule(total, first, months).map((p) => ({ ...p, campaignId: String(campaignId) })),
  });
  revalidatePath(detail(campaignId));
  revalidatePath(LIST);
}

export async function updatePayment(id, fd) {
  await requireEditor();
  const p = await prisma.campaignPayment.findUnique({ where: { id: String(id) } });
  if (!p) return;
  const status = pick(text(fd, "status"), PAYMENT, p.status);
  await prisma.campaignPayment.update({
    where: { id: p.id },
    data: {
      status,
      amountPence: toPence(fd.get("amount")) ?? p.amountPence,
      dueDate: fromDateInput(fd.get("dueDate")) || p.dueDate,
      invoiceRef: orNull(text(fd, "invoiceRef")),
      // The day the money landed is what a month's revenue counts by, so it
      // can be typed; it defaults to today when marked paid without one.
      paidAt: status === "paid" ? fromDateInput(fd.get("paidAt")) || p.paidAt || new Date() : null,
    },
  });
  revalidatePath(detail(p.campaignId));
  revalidatePath(LIST);
}

export async function deletePayment(id) {
  await requireEditor();
  const p = await prisma.campaignPayment.delete({ where: { id: String(id) } });
  revalidatePath(detail(p.campaignId));
  revalidatePath(LIST);
}

// ---------- results

export async function addResult(campaignId, fd) {
  await requireEditor();
  const periodEnd = fromDateInput(fd.get("periodEnd"));
  if (!periodEnd) return;
  const nums = { impressions: int(fd, "impressions"), clicks: int(fd, "clicks"), recipients: int(fd, "recipients"), opens: int(fd, "opens") };
  if (Object.values(nums).every((v) => v == null)) return;
  await prisma.campaignResult.create({
    data: {
      campaignId: String(campaignId),
      deliverableId: await deliverableOf(String(campaignId), fd),
      periodStart: fromDateInput(fd.get("periodStart")),
      periodEnd,
      ...nums,
      source: pick(text(fd, "source"), SOURCES, "manual"),
      notes: orNull(text(fd, "notes")),
    },
  });
  revalidatePath(detail(campaignId));
  revalidatePath(LIST);
}

export async function deleteResult(id) {
  await requireEditor();
  const r = await prisma.campaignResult.delete({ where: { id: String(id) } });
  revalidatePath(detail(r.campaignId));
  revalidatePath(LIST);
}

// ---------- assets

async function uploader() {
  const session = await auth();
  return session?.user?.name || session?.user?.email || null;
}

/**
 * Store the files picked, one row each. Returns { ok, message } for the
 * upload form. Images are measured so the page can show 300×250 against the
 * spec without anyone opening the file.
 */
export async function uploadAssets(campaignId, _prev, fd) {
  await requireEditor();
  const id = String(campaignId);
  const files = fd.getAll("files").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!files.length) return { ok: false, message: "Pick at least one file." };
  const deliverableId = await deliverableOf(id, fd);
  const position = deliverableId
    ? (await prisma.campaignDeliverable.findUnique({ where: { id: deliverableId }, select: { position: true } }))?.position || null
    : null;
  const uploadedBy = await uploader();
  const tooBig = [];
  const flagged = [];
  let saved = 0;
  for (const f of files) {
    if (f.size > MAX_FILE) {
      tooBig.push(f.name);
      continue;
    }
    const data = Buffer.from(await f.arrayBuffer());
    let width = null;
    let height = null;
    if (/^image\//.test(f.type)) {
      try {
        const { sharp } = await imaging();
        const m = await sharp(data, { animated: false }).metadata();
        width = m.width ?? null;
        height = m.height ?? null;
      } catch {
        // Not every image sharp is handed can be read (some SVGs); the file is still kept.
      }
    }
    // The copy the sites serve (lib/ad-creative.js). Made for every image, so
    // artwork uploaded before it is assigned to a placement is ready anyway.
    const web = width ? await (await imaging()).makeWebCopy(data, { mimeType: f.type, position }) : null;
    if (position && width) {
      const c = checkCreative(position, { width, height, mimeType: f.type, webBytes: web?.webSize });
      if (!c.ok) flagged.push(`${f.name}: ${c.problems.join("; ")}`);
    }
    await prisma.campaignAsset.create({
      data: { campaignId: id, deliverableId, name: f.name, mimeType: f.type || null, size: f.size, data, width, height, uploadedBy, ...(web || {}) },
    });
    saved++;
  }
  revalidatePath(detail(id));
  // "Replace": the new artwork goes into rotation and everything that was
  // running in this placement comes out, kept on file rather than deleted.
  if (deliverableId && saved && fd.get("replace") === "1") {
    const fresh = await prisma.campaignAsset.findMany({
      where: { deliverableId },
      orderBy: { createdAt: "desc" },
      take: saved,
      select: { id: true },
    });
    await prisma.campaignAsset.updateMany({
      where: { deliverableId, id: { notIn: fresh.map((a) => a.id) } },
      data: { active: false },
    });
  }
  if (deliverableId && saved) await refreshForDeliverables([deliverableId]);
  const parts = [];
  if (saved) parts.push(`${saved} file${saved === 1 ? "" : "s"} saved.`);
  if (flagged.length) parts.push(`Outside the spec: ${flagged.join(" · ")}`);
  if (tooBig.length) parts.push(`Over 3.8 MB, so not stored: ${tooBig.join(", ")}. Add a link to those instead.`);
  return { ok: saved > 0 && !flagged.length, message: parts.join(" ") };
}

/** For material too big to keep here: a Drive folder, a WeTransfer, a video. */
export async function addAssetLink(campaignId, fd) {
  await requireEditor();
  const url = text(fd, "url");
  if (!/^https?:\/\//i.test(url)) return;
  const id = String(campaignId);
  await prisma.campaignAsset.create({
    data: {
      campaignId: id,
      deliverableId: await deliverableOf(id, fd),
      name: text(fd, "name") || url,
      url,
      uploadedBy: await uploader(),
    },
  });
  revalidatePath(detail(id));
}

export async function deleteAsset(id) {
  await requireEditor();
  const a = await prisma.campaignAsset.delete({ where: { id: String(id) }, select: { campaignId: true, deliverableId: true } });
  revalidatePath(detail(a.campaignId));
  if (a.deliverableId) await refreshForDeliverables([a.deliverableId]);
}

// ---------- placements served by the ad plugin

/**
 * Tell every title these placements run on to pull its feed now, so a change
 * is on the site in seconds. Capped at a few seconds: a slow site must not
 * hold up the button, and its five-minute refresh catches up regardless.
 */
async function refreshForDeliverables(ids) {
  const rows = await prisma.campaignDeliverable.findMany({ where: { id: { in: ids.map(String) } }, select: { siteId: true } });
  const siteIds = rows.map((r) => r.siteId).filter(Boolean);
  if (!siteIds.length) return;
  await Promise.race([refreshSites(siteIds), new Promise((r) => setTimeout(r, 4000))]);
}

/** Target URL, dates and the Mailchimp campaign for one placement. */
export async function updatePlacement(id, fd) {
  await requireEditor();
  const d = await prisma.campaignDeliverable.findUnique({ where: { id: String(id) } });
  if (!d) return;
  // Only the fields the form sent: the list's panel saves the link alone, and
  // must not blank the Mailchimp id or the dates on the way past.
  const data = {};
  if (fd.has("targetUrl")) {
    const url = text(fd, "targetUrl");
    data.targetUrl = /^https?:\/\//i.test(url) ? url : null;
  }
  if (fd.has("mailchimpCampaignId")) data.mailchimpCampaignId = orNull(text(fd, "mailchimpCampaignId"));
  if (fd.has("dueDate")) data.dueDate = fromDateInput(fd.get("dueDate"));
  if (fd.has("runUntil")) data.runUntil = fromDateInput(fd.get("runUntil"));
  if (fd.has("assetsDue")) data.assetsDue = fromDateInput(fd.get("assetsDue"));
  await prisma.campaignDeliverable.update({ where: { id: d.id }, data });
  revalidatePath(detail(d.campaignId));
  revalidatePath(LIST);
  await refreshForDeliverables([d.id]);
}

/** Copy one placement's target URL to every placement in the campaign that has none. */
export async function fillTargetUrls(campaignId, fd) {
  await requireEditor();
  const url = text(fd, "targetUrl");
  if (!/^https?:\/\//i.test(url)) return;
  const rows = await prisma.campaignDeliverable.findMany({
    where: { campaignId: String(campaignId), position: { not: null }, targetUrl: null },
    select: { id: true },
  });
  await prisma.campaignDeliverable.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { targetUrl: url } });
  revalidatePath(detail(campaignId));
  await refreshForDeliverables(rows.map((r) => r.id));
}

/** Take a placement down, or put it back. The booking and its dates are kept either way. */
export async function setPaused(id, paused) {
  await requireEditor();
  const d = await prisma.campaignDeliverable.update({ where: { id: String(id) }, data: { paused: Boolean(paused) } });
  revalidatePath(detail(d.campaignId));
  await refreshForDeliverables([d.id]);
}

/** Put a creative into, or out of, its placement's rotation. This is how a banner is swapped. */
export async function setAssetActive(id, active) {
  await requireEditor();
  const a = await prisma.campaignAsset.update({
    where: { id: String(id) },
    data: { active: Boolean(active) },
    select: { campaignId: true, deliverableId: true },
  });
  revalidatePath(detail(a.campaignId));
  if (a.deliverableId) await refreshForDeliverables([a.deliverableId]);
}

/**
 * Move a creative to a placement (or back to the whole campaign). The served
 * copy is remade for the new slot, since a banner sized for an MPU is the
 * wrong file for a leaderboard and email needs a different format.
 */
export async function assignAsset(id, fd) {
  await requireEditor();
  const a = await prisma.campaignAsset.findUnique({ where: { id: String(id) } });
  if (!a) return;
  const deliverableId = await deliverableOf(a.campaignId, fd);
  const position = deliverableId
    ? (await prisma.campaignDeliverable.findUnique({ where: { id: deliverableId }, select: { position: true } }))?.position || null
    : null;
  const web = a.data && a.width ? await (await imaging()).makeWebCopy(Buffer.from(a.data), { mimeType: a.mimeType, position }) : null;
  await prisma.campaignAsset.update({ where: { id: a.id }, data: { deliverableId, ...(web || {}) } });
  revalidatePath(detail(a.campaignId));
  await refreshForDeliverables([a.deliverableId, deliverableId].filter(Boolean));
}

const monthEndUtc = (y, m) => new Date(Date.UTC(y, m, 0, 12));
const monthStartUtc = (y, m) => new Date(Date.UTC(y, m - 1, 1, 12));
const shortMonth = (y, m) => new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

/**
 * Book placements from the month grid, laid out the way a plan like Miele's
 * 2027 deck is: a row per position, a column per month, a tick per booking.
 * Runs of ticked months on a served position become one placement (a 12-month
 * leaderboard is one row to manage, not twelve); email positions get one per
 * month, since each is its own send. Months another campaign already holds on
 * a served position are refused and named. Returns { ok, message }.
 */
export async function planPlacements(campaignId, _prev, fd) {
  await requireEditor();
  const c = await prisma.campaign.findUnique({ where: { id: String(campaignId) } });
  if (!c) return { ok: false, message: "Campaign not found." };
  const cells = [...new Set(fd.getAll("cell").map(String))]
    .map((v) => v.split("|"))
    .filter(([siteId, position, ym]) => siteId && positionInfo(position) && /^\d{4}-\d{2}$/.test(ym || ""));
  if (!cells.length) return { ok: false, message: "Tick at least one month." };

  const sites = new Map((await prisma.site.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const url = text(fd, "targetUrl");
  const targetUrl = /^https?:\/\//i.test(url) ? url : null;
  const all = await bookingsMap({});
  const clashes = [];
  const groups = new Map();
  for (const [siteId, position, ym] of cells) {
    if (!sites.has(siteId)) continue;
    const key = `${siteId}|${position}|${ym}`;
    const holders = all.get(key) || [];
    // Already booked by this campaign: ticking it again must not double it.
    if (holders.some((b) => b.campaignId === c.id)) continue;
    const other = holders.find((b) => b.campaignId !== c.id);
    if (positionInfo(position).served && other) {
      clashes.push(`${positionInfo(position).label} on ${sites.get(siteId)} in ${ym} (${other.advertiser})`);
      continue;
    }
    const g = `${siteId}|${position}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(ym);
  }

  const rows = [];
  for (const [g, months] of groups) {
    const [siteId, position] = g.split("|");
    const info = positionInfo(position);
    months.sort();
    const runs = [];
    for (const ym of months) {
      const [y, m] = ym.split("-").map(Number);
      const last = runs.at(-1);
      const next = last && (last.end[1] === 12 ? [last.end[0] + 1, 1] : [last.end[0], last.end[1] + 1]);
      if (info.served && next && next[0] === y && next[1] === m) last.end = [y, m];
      else runs.push({ start: [y, m], end: [y, m] });
    }
    for (const r of runs) {
      const [sy, sm] = r.start;
      const [ey, em] = r.end;
      const span =
        sy === ey && sm === em
          ? `${shortMonth(sy, sm)} ${sy}`
          : `${shortMonth(sy, sm)}${sy === ey ? "" : ` ${sy}`} to ${shortMonth(ey, em)} ${ey}`;
      const start = monthStartUtc(sy, sm);
      rows.push({
        campaignId: c.id,
        siteId,
        position,
        product: productFor(position),
        title: `${info.label}, ${sites.get(siteId)}, ${span}`,
        spec: info.size
          ? `${info.size[0]}×${info.size[1]}${info.maxKb ? `, under ${info.maxKb} KB` : ""}, PNG, JPG or GIF. ${info.where}.`
          : `${info.where}.`,
        dueDate: start,
        runUntil: info.served ? monthEndUtc(ey, em) : null,
        // A week before it starts, so there is time to chase it and check it.
        assetsDue: new Date(start.getTime() - 7 * 864e5),
        status: "awaiting_assets",
        targetUrl,
      });
    }
  }
  if (rows.length) await prisma.campaignDeliverable.createMany({ data: rows });
  revalidatePath(detail(c.id));
  revalidatePath(LIST);
  revalidatePath("/campaigns/availability");
  if (rows.length) await Promise.race([refreshSites(rows.map((r) => r.siteId)), new Promise((r) => setTimeout(r, 4000))]);
  const parts = [`${rows.length} placement${rows.length === 1 ? "" : "s"} added.`];
  if (clashes.length) parts.push(`Already booked, so left out: ${clashes.join("; ")}.`);
  return { ok: !clashes.length, message: parts.join(" ") };
}

/**
 * Pull today's counts from the titles this campaign runs on, now rather than
 * at the nightly run. The plugin counts as it goes; this only copies what it
 * has into the incubator. Returns { ok, message }.
 */
export async function refreshCampaignStats(campaignId) {
  await requireEditor();
  const rows = await prisma.campaignDeliverable.findMany({
    where: { campaignId: String(campaignId), siteId: { not: null }, position: { not: null } },
    select: { siteId: true },
  });
  const ids = [...new Set(rows.map((r) => r.siteId))];
  const sites = await prisma.site.findMany({ where: { id: { in: ids } } });
  const failed = [];
  for (const site of sites) {
    try {
      await pullSiteStats(site, 7);
    } catch (e) {
      failed.push(`${site.name}: ${String(e.message || e).slice(0, 80)}`);
    }
  }
  revalidatePath(LIST);
  revalidatePath(detail(campaignId));
  return failed.length ? { ok: false, message: `Could not reach ${failed.join("; ")}` } : { ok: true, message: "Numbers updated." };
}
