"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { prisma } from "./prisma";
import { auth } from "./auth";
import { requireEditor } from "./permissions";
import { fromDateInput, monthlySchedule, toPence } from "./campaigns";

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

/** Returns { ok, message } when the form is short of something; redirects to the new campaign otherwise. */
export async function createCampaign(_prev, fd) {
  await requireEditor();
  const advertiserId = text(fd, "advertiserId");
  const adv = advertiserId && (await prisma.advertiser.findUnique({ where: { id: advertiserId }, select: { id: true } }));
  const data = campaignFields(fd);
  if (!adv) return { ok: false, message: "Pick the advertiser from the list. A brand not on it yet is added on the Advertisers tab." };
  if (!data.name) return { ok: false, message: "Give the campaign a name." };
  const c = await prisma.campaign.create({ data: { ...data, advertiserId: adv.id, siteIds: await readTitles(fd) } });
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
  if (!data.title) return;
  await prisma.campaignDeliverable.create({
    data: { ...data, campaignId: String(campaignId), siteId: await siteOrNull(fd) },
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
  const uploadedBy = await uploader();
  const tooBig = [];
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
        const m = await sharp(data, { animated: false }).metadata();
        width = m.width ?? null;
        height = m.height ?? null;
      } catch {
        // Not every image sharp is handed can be read (some SVGs); the file is still kept.
      }
    }
    await prisma.campaignAsset.create({
      data: { campaignId: id, deliverableId, name: f.name, mimeType: f.type || null, size: f.size, data, width, height, uploadedBy },
    });
    saved++;
  }
  revalidatePath(detail(id));
  const parts = [];
  if (saved) parts.push(`${saved} file${saved === 1 ? "" : "s"} saved.`);
  if (tooBig.length) parts.push(`Over 3.8 MB, so not stored: ${tooBig.join(", ")}. Add a link to those instead.`);
  return { ok: saved > 0, message: parts.join(" ") };
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
  const a = await prisma.campaignAsset.delete({ where: { id: String(id) }, select: { campaignId: true } });
  revalidatePath(detail(a.campaignId));
}
