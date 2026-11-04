"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "./prisma";
import { auth } from "./auth";
import { requireEditor } from "./permissions";
import { elementLabel, fromDateInput, ukDay, monthlySchedule, toPence } from "./campaigns";
import { checkCreative, orderBook, positionInfo, productFor, slotLabel, specFor, unitsIn } from "./ad-positions";
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

/**
 * Tell these titles to pull their feed once the response has gone, so a
 * button answers at once and the site still has the change within seconds.
 * (Awaiting it held "Booking…" on screen for up to four seconds a title.)
 */
function refreshLater(siteIds) {
  const ids = [...new Set(siteIds.filter(Boolean))];
  if (ids.length) after(() => refreshSites(ids).catch(() => {}));
}

// ---------- order lines

const LINE_FIELDS = ["slot", "siteId", "quantity", "title", "assetsDue", "dueDate", "status"];
const SLOTS = new Set([...["leaderboard", "billboard", "mpu", "mpu_lower", "popup", "newsletter_banner", "solus", "sponsored_article"], "other"]);

/**
 * One order line as stored, from the values a form sent for it. siteId
 * "each" is expanded by the caller into one line per campaign title. A line
 * is named from its placement and title, so nobody types names; only Other
 * needs one. The spec comes from the placement for the same reason.
 */
function orderLine(v, siteNames) {
  const slot = SLOTS.has(v.slot) ? v.slot : null;
  if (!slot) return null;
  const quantity = Math.max(1, Math.min(120, Math.round(Number(v.quantity)) || 1));
  const siteId = siteNames.has(v.siteId) ? v.siteId : null;
  const name = slot === "other" ? String(v.title || "").trim() || "Other" : slotLabel(slot);
  const assetsDue = fromDateInput(v.assetsDue);
  return {
    slot,
    quantity,
    siteId,
    product: slot === "other" ? "other" : productFor(slot),
    title: [`${quantity} × ${name}`, siteId && siteNames.get(siteId)].filter(Boolean).join(", "),
    spec: specFor(slot),
    assetsDue,
    dueDate: fromDateInput(v.dueDate),
    ...(v.status ? { status: pick(v.status, DELIVERABLE, "planned") } : { status: assetsDue ? "awaiting_assets" : "planned" }),
  };
}

/** The values for each siteId "each" line, once per title: the campaign's, or every title for an all-titles campaign. */
function expandEach(values, campaignSiteIds, allSiteIds) {
  const each = campaignSiteIds.length ? campaignSiteIds : allSiteIds;
  return values.flatMap((v) => (v.siteId === "each" ? each.map((siteId) => ({ ...v, siteId })) : [v]));
}

const nextMonths = (ym, n) => {
  let [y, m] = ym.split("-").map(Number);
  return Array.from({ length: n }, () => {
    const out = `${y}-${String(m).padStart(2, "0")}`;
    m === 12 ? ((y += 1), (m = 1)) : (m += 1);
    return out;
  });
};

/**
 * An order line given a start date and nothing booked yet is booked from that
 * month: a 12-month leaderboard from January is January to December, 4
 * e-shots from March are March, April, May and June (moved in the grid after
 * if they are quarterly). Returns the clash messages, if any.
 */
async function scheduleFromStart(c, lines) {
  const book = orderBook(await prisma.campaignDeliverable.findMany({ where: { campaignId: c.id } }));
  const cells = [];
  for (const l of lines) {
    if (!l.dueDate || !l.siteId || !positionInfo(l.slot)) continue;
    if ((book.get(`${l.siteId}|${l.slot}`)?.booked || 0) > 0) continue;
    for (const ym of nextMonths(ukDay(l.dueDate).slice(0, 7), l.quantity)) cells.push([l.siteId, l.slot, ym]);
  }
  if (!cells.length) return [];
  const { clashes } = await bookCells(c, cells, null);
  return clashes;
}

// ---------- campaigns

/**
 * The elements added on the booking form, as new:<n>: fields like the
 * campaign page's: placement, title (or "each" of the campaign's titles),
 * Qty/Duration and optional dates.
 */
async function readElements(fd, campaignSiteIds) {
  const raw = idsUnder(fd, "new:").map((k) => Object.fromEntries(LINE_FIELDS.map((f) => [f, fd.get(`new:${k}:${f}`)?.toString() ?? ""])));
  if (raw.some((e) => !SLOTS.has(e.slot))) return { error: "Pick a placement for every element." };
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  const names = new Map(sites.map((s) => [s.id, s.name]));
  const rows = expandEach(raw.slice(0, 50), campaignSiteIds, sites.map((s) => s.id))
    .map((e) => orderLine(e, names))
    .filter(Boolean);
  return { rows };
}

/** Returns { ok, message } when the form is short of something; redirects to the new campaign otherwise. */
export async function createCampaign(_prev, fd) {
  await requireEditor();
  const advertiserId = text(fd, "advertiserId");
  const adv = advertiserId && (await prisma.advertiser.findUnique({ where: { id: advertiserId }, select: { id: true } }));
  const data = campaignFields(fd);
  if (!adv) return { ok: false, message: "Pick the advertiser from the list. A brand not on it yet is added on the Advertisers tab." };
  if (!data.name) return { ok: false, message: "Give the campaign a name." };

  const siteIds = await readTitles(fd);
  const elements = await readElements(fd, siteIds);
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
      siteIds,
      deliverables: { create: elements.rows },
      payments: { create: payments },
    },
  });
  // Elements given a start date are put in the grid straight away.
  await scheduleFromStart(c, elements.rows);
  revalidatePath(LIST);
  redirect(detail(c.id));
}

/** The fields of one thing on the master form, read as if they were their own form. */
const scoped = (fd, prefix) => ({
  get: (k) => fd.get(prefix + k),
  getAll: (k) => fd.getAll(prefix + k),
  has: (k) => fd.has(prefix + k),
});
/** The ids that have fields under a prefix: "o:abc:quantity" gives "abc" for "o:". */
const idsUnder = (fd, prefix) => [...new Set([...fd.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length).split(":")[0]))];
const sameDay = (a, b) => (a ? a.getTime() : null) === (b ? b.getTime() : null);

/**
 * The campaign page's one Save. Every editable field on the page belongs to
 * one form (form="campaign-save") named by what it edits: c: the campaign,
 * o:<id>: an order line, new:<n>: an order line added on the page, p:<id>: a
 * booked placement, pay:<id>: an instalment. JB, 4 Nov 2026: one save that
 * floats at the bottom, not a small Save button per row. Uploads, bookings
 * and take-downs still act at once, because they are actions rather than edits.
 */
export async function saveCampaign(campaignId, _prev, fd) {
  await requireEditor();
  const c = await prisma.campaign.findUnique({
    where: { id: String(campaignId) },
    include: { deliverables: true, payments: true },
  });
  if (!c) return { ok: false, message: "Campaign not found." };
  const byId = new Map(c.deliverables.map((d) => [d.id, d]));
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  const names = new Map(sites.map((s) => [s.id, s.name]));
  const ops = [];
  const touched = [];
  const toSchedule = [];

  let siteIds = c.siteIds;
  if (fd.has("c:name")) {
    const cf = scoped(fd, "c:");
    const data = campaignFields(cf);
    if (!data.name) return { ok: false, message: "The campaign needs a name (under Campaign details)." };
    siteIds = await readTitles(cf);
    ops.push(prisma.campaign.update({ where: { id: c.id }, data: { ...data, siteIds } }));
  }

  const read = (prefix, keys) => {
    const s = scoped(fd, prefix);
    return Object.fromEntries(keys.filter((k) => s.has(k)).map((k) => [k, s.get(k)?.toString() ?? ""]));
  };
  const LINE = LINE_FIELDS;

  for (const id of idsUnder(fd, "o:")) {
    const d = byId.get(id);
    if (!d) continue;
    const line = orderLine(read(`o:${id}:`, LINE), names);
    if (!line) continue;
    ops.push(prisma.campaignDeliverable.update({ where: { id }, data: line }));
    // A start date typed in for the first time books it from that month.
    if (line.dueDate && !sameDay(line.dueDate, d.dueDate)) toSchedule.push(line);
  }

  const fresh = idsUnder(fd, "new:").map((k) => read(`new:${k}:`, LINE));
  const created = expandEach(fresh, siteIds, sites.map((s) => s.id))
    .map((v) => orderLine(v, names))
    .filter(Boolean);
  for (const line of created) {
    ops.push(prisma.campaignDeliverable.create({ data: { ...line, campaignId: c.id } }));
    if (line.dueDate) toSchedule.push(line);
  }

  // A grouped placement's one link: grp:<id,id,...>:targetUrl.
  for (const key of idsUnder(fd, "grp:")) {
    const url = (fd.get(`grp:${key}:targetUrl`) || "").toString().trim();
    const targetUrl = /^https?:\/\//i.test(url) ? url : null;
    for (const id of key.split(",")) {
      const d = byId.get(id);
      if (!d || d.targetUrl === targetUrl) continue;
      ops.push(prisma.campaignDeliverable.update({ where: { id }, data: { targetUrl } }));
      touched.push(d.siteId);
    }
  }

  for (const id of idsUnder(fd, "p:")) {
    const d = byId.get(id);
    if (!d) continue;
    const v = read(`p:${id}:`, ["targetUrl", "dueDate", "runUntil", "mailchimpCampaignId"]);
    const data = {};
    if ("targetUrl" in v) data.targetUrl = /^https?:\/\//i.test(v.targetUrl.trim()) ? v.targetUrl.trim() : null;
    if ("mailchimpCampaignId" in v) data.mailchimpCampaignId = orNull(v.mailchimpCampaignId.trim());
    if ("dueDate" in v) data.dueDate = fromDateInput(v.dueDate);
    if ("runUntil" in v) data.runUntil = fromDateInput(v.runUntil);
    const changed =
      ("targetUrl" in data && data.targetUrl !== d.targetUrl) ||
      ("mailchimpCampaignId" in data && data.mailchimpCampaignId !== d.mailchimpCampaignId) ||
      ("dueDate" in data && !sameDay(data.dueDate, d.dueDate)) ||
      ("runUntil" in data && !sameDay(data.runUntil, d.runUntil));
    if (!changed) continue;
    ops.push(prisma.campaignDeliverable.update({ where: { id }, data }));
    touched.push(d.siteId);
  }

  const pays = new Map(c.payments.map((p) => [p.id, p]));
  for (const id of idsUnder(fd, "pay:")) {
    const p = pays.get(id);
    if (!p) continue;
    const s = scoped(fd, `pay:${id}:`);
    const status = pick(text(s, "status"), PAYMENT, p.status);
    ops.push(
      prisma.campaignPayment.update({
        where: { id },
        data: {
          status,
          amountPence: toPence(s.get("amount")) ?? p.amountPence,
          dueDate: fromDateInput(s.get("dueDate")) || p.dueDate,
          invoiceRef: orNull(text(s, "invoiceRef")),
          paidAt: status === "paid" ? fromDateInput(s.get("paidAt")) || p.paidAt || new Date() : null,
        },
      })
    );
  }

  await prisma.$transaction(ops);
  const clashes = toSchedule.length ? await scheduleFromStart(c, toSchedule) : [];
  refreshLater(touched);
  revalidatePath(detail(c.id));
  revalidatePath(LIST);
  revalidatePath("/campaigns/availability");
  const msg = clashes.length ? `Saved. These months were already taken, so pick others in the grid: ${clashes.join("; ")}.` : "✓ Saved";
  return { ok: !clashes.length, message: msg, at: Date.now() };
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
  if (d.position && d.siteId) refreshLater([d.siteId]);
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
  // "Also use for": the same artwork on this title's other placements of the
  // same kind, so twelve newsletter banners take one upload, not twelve.
  const alsoIds = fd.getAll("alsoFor").map(String);
  const also =
    deliverableId && position && alsoIds.length
      ? (
          await prisma.campaignDeliverable.findMany({
            where: { id: { in: alsoIds, not: deliverableId }, campaignId: id, position },
            select: { id: true },
          })
        ).map((d) => d.id)
      : [];
  const targets = deliverableId ? [deliverableId, ...also] : [null];
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
    for (const target of targets) {
      await prisma.campaignAsset.create({
        data: { campaignId: id, deliverableId: target, name: f.name, mimeType: f.type || null, size: f.size, data, width, height, uploadedBy, ...(web || {}) },
      });
    }
    saved++;
  }
  revalidatePath(detail(id));
  // "Replace": the new artwork goes into rotation and everything that was
  // running in this placement comes out, kept on file rather than deleted.
  if (deliverableId && saved && fd.get("replace") === "1") {
    for (const target of targets) {
      const fresh = await prisma.campaignAsset.findMany({
        where: { deliverableId: target },
        orderBy: { createdAt: "desc" },
        take: saved,
        select: { id: true },
      });
      await prisma.campaignAsset.updateMany({
        where: { deliverableId: target, id: { notIn: fresh.map((a) => a.id) } },
        data: { active: false },
      });
    }
  }
  if (deliverableId && saved) await refreshForDeliverables(targets);
  const parts = [];
  if (saved) parts.push(`✓ ${saved} file${saved === 1 ? "" : "s"} saved${also.length ? `, on ${also.length + 1} placements` : ""}.`);
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
  const ids = [id].flat().map(String);
  const rows = await prisma.campaignAsset.findMany({ where: { id: { in: ids } }, select: { campaignId: true, deliverableId: true } });
  await prisma.campaignAsset.deleteMany({ where: { id: { in: ids } } });
  if (rows[0]) revalidatePath(detail(rows[0].campaignId));
  const ds = rows.map((r) => r.deliverableId).filter(Boolean);
  if (ds.length) await refreshForDeliverables(ds);
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
  if (siteIds.length) refreshLater(siteIds);
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
  // One id, or every month of a grouped placement (the campaign page shows a
  // title's newsletter banners as one card).
  const ids = [id].flat().map(String);
  await prisma.campaignDeliverable.updateMany({ where: { id: { in: ids } }, data: { paused: Boolean(paused) } });
  const d = await prisma.campaignDeliverable.findUnique({ where: { id: ids[0] }, select: { campaignId: true } });
  if (d) revalidatePath(detail(d.campaignId));
  await refreshForDeliverables(ids);
}

/** Put a creative into, or out of, its placement's rotation. This is how a banner is swapped. */
export async function setAssetActive(id, active) {
  await requireEditor();
  // One id, or the copies of one creative across a grouped placement's months.
  const ids = [id].flat().map(String);
  await prisma.campaignAsset.updateMany({ where: { id: { in: ids } }, data: { active: Boolean(active) } });
  const rows = await prisma.campaignAsset.findMany({ where: { id: { in: ids } }, select: { campaignId: true, deliverableId: true } });
  if (rows[0]) revalidatePath(detail(rows[0].campaignId));
  const ds = rows.map((r) => r.deliverableId).filter(Boolean);
  if (ds.length) await refreshForDeliverables(ds);
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
  const url = text(fd, "targetUrl");
  const { rows, clashes } = await bookCells(c, cells, /^https?:\/\//i.test(url) ? url : null);
  const months = rows.reduce((n, r) => n + unitsIn(r), 0);
  const parts = [months ? `✓ Booked ${months} month${months === 1 ? "" : "s"}.` : "Nothing new to book."];
  if (clashes.length) parts.push(`Already booked, so left out: ${clashes.join("; ")}.`);
  return { ok: !clashes.length, message: parts.join(" "), at: Date.now() };
}

/**
 * Book [siteId, position, "YYYY-MM"] cells for a campaign. A click-through URL
 * not given is taken from the campaign's other placements, since it is
 * nearly always the same one. Returns { rows, clashes }.
 */
async function bookCells(c, cells, targetUrlIn) {
  const sites = new Map((await prisma.site.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const targetUrl =
    targetUrlIn ||
    (await prisma.campaignDeliverable.findFirst({ where: { campaignId: c.id, targetUrl: { not: null } }, select: { targetUrl: true } }))?.targetUrl ||
    null;
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
        spec: specFor(position),
        dueDate: start,
        runUntil: info.served ? monthEndUtc(ey, em) : null,
        // A week before it starts, so there is time to chase it and check it.
        assetsDue: new Date(start.getTime() - 7 * 864e5),
        status: "awaiting_assets",
        targetUrl,
      });
    }
  }
  if (rows.length) {
    // A month added to a placement that already has artwork gets the same
    // artwork, so a title's newsletter banners stay one thing to manage.
    const art = new Map();
    for (const g of new Set(rows.map((r) => `${r.siteId}|${r.position}`))) {
      const [siteId, position] = g.split("|");
      const sib = await prisma.campaignDeliverable.findFirst({
        where: { campaignId: c.id, siteId, position, assets: { some: { active: true, url: null } } },
        orderBy: { dueDate: "desc" },
        select: { assets: { where: { active: true, url: null } } },
      });
      if (sib) art.set(g, sib.assets);
    }
    await prisma.$transaction(
      rows.map((r) =>
        prisma.campaignDeliverable.create({
          data: {
            ...r,
            assets: {
              create: (art.get(`${r.siteId}|${r.position}`) || []).map(({ id: _id, campaignId, deliverableId: _d, createdAt: _c, ...a }) => ({ ...a, campaignId })),
            },
          },
        })
      )
    );
  }
  revalidatePath(detail(c.id));
  revalidatePath(LIST);
  revalidatePath("/campaigns/availability");
  if (rows.length) refreshLater(rows.map((r) => r.siteId));
  return { rows, clashes };
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
