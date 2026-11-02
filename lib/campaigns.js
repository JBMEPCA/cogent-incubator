// Shared rules for booked campaigns (see Campaign in the schema): the status
// lists, how a deadline is judged, and the money sums. No "use server" here,
// so pages and actions can both import it.

export const CAMPAIGN_STATUSES = [
  { value: "booked", label: "Booked", chip: "chip-brand" },
  { value: "live", label: "Live", chip: "chip-audience" },
  { value: "complete", label: "Complete", chip: "chip-general" },
  { value: "cancelled", label: "Cancelled", chip: "chip-monetise" },
];

export const DELIVERABLE_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "awaiting_assets", label: "Waiting on client" },
  { value: "in_production", label: "In production" },
  { value: "live", label: "Live" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export const PAYMENT_STATUSES = [
  { value: "expected", label: "Expected" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
];

export const RESULT_SOURCES = [
  { value: "manual", label: "Typed in" },
  { value: "ga4", label: "GA4" },
  { value: "mailchimp", label: "Mailchimp" },
  { value: "client", label: "Client's ad server" },
];

export const campaignStatus = (v) => CAMPAIGN_STATUSES.find((s) => s.value === v) || CAMPAIGN_STATUSES[0];
export const deliverableStatusLabel = (v) => DELIVERABLE_STATUSES.find((s) => s.value === v)?.label || v;
export const paymentStatusLabel = (v) => PAYMENT_STATUSES.find((s) => s.value === v)?.label || v;

/** "£1,250.00" from pence. Net of VAT throughout. */
export function money(pence) {
  return ((pence || 0) / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

/** Pence from a typed amount, tolerant of "£1,250" and "1250.5". NaN-safe: bad input is null. */
export function toPence(input) {
  const n = Number(String(input ?? "").replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// The UK calendar day, as YYYY-MM-DD so days compare as text. Dates are
// stored at 12:00 UTC on the day picked, so BST can never move them a day.
export const ukDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
export const ukMonth = (d) => ukDay(d).slice(0, 7);

/** A <input type="date"> value as a stored instant, or null. */
export function fromDateInput(v) {
  const s = String(v || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : null;
}

const DONE = new Set(["live", "delivered", "cancelled"]);
const SOON_DAYS = 7;

/**
 * Where a deliverable stands against its deadlines, for the attention list.
 * level: overdue | client_late | soon | ok | done. A client who is late with
 * material is told apart from us being late, because that is the first
 * question when a date slips.
 */
export function deliverableState(d, now = new Date()) {
  if (DONE.has(d.status)) return { level: "done", label: deliverableStatusLabel(d.status) };
  const today = ukDay(now);
  const soon = ukDay(new Date(now.getTime() + SOON_DAYS * 864e5));
  if (d.dueDate && ukDay(d.dueDate) < today) return { level: "overdue", label: "Overdue" };
  if (d.status === "awaiting_assets" || d.status === "planned") {
    if (d.assetsDue && ukDay(d.assetsDue) < today) return { level: "client_late", label: "Client material late" };
  }
  if (d.dueDate && ukDay(d.dueDate) <= soon) return { level: "soon", label: "Due this week" };
  if (d.assetsDue && ukDay(d.assetsDue) <= soon && d.status !== "in_production")
    return { level: "soon", label: "Material due this week" };
  return { level: "ok", label: deliverableStatusLabel(d.status) };
}

export const STATE_CHIP = {
  overdue: "chip-monetise",
  client_late: "chip-monetise",
  soon: "chip-content",
  ok: "chip-general",
  done: "chip-audience",
};

/** A payment past its date and not paid. */
export const paymentLate = (p, now = new Date()) => p.status !== "paid" && ukDay(p.dueDate) < ukDay(now);

/**
 * Split a total into monthly instalments that add up to the penny: any
 * remainder goes on the first month. Due on the same day of each month,
 * clamped to the month's last day (31 Jan, 28 Feb, 31 Mar).
 */
export function monthlySchedule(totalPence, firstDue, months) {
  const n = Math.max(1, Math.min(36, Math.floor(months)));
  const each = Math.floor(totalPence / n);
  const rest = totalPence - each * n;
  const [y, m, d] = ukDay(firstDue).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const mi = m - 1 + i;
    const year = y + Math.floor(mi / 12);
    const month = mi % 12;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return {
      amountPence: each + (i === 0 ? rest : 0),
      dueDate: new Date(Date.UTC(year, month, Math.min(d, last), 12)),
    };
  });
}

/**
 * Money in by UK calendar month, for the profit view: what landed (paid, by
 * the day it was paid) and what is still expected (by due date). Cancelled
 * campaigns are left out. Months are "YYYY-MM".
 *
 * Meant for the fleet home page's revenue against cost panel.
 */
export async function revenueByMonth(db, { from, to } = {}) {
  const payments = await db.campaignPayment.findMany({
    where: { campaign: { status: { not: "cancelled" } } },
    select: { amountPence: true, dueDate: true, paidAt: true, status: true },
  });
  const months = new Map();
  const bucket = (k) => {
    if (!months.has(k)) months.set(k, { month: k, paidPence: 0, expectedPence: 0 });
    return months.get(k);
  };
  for (const p of payments) {
    if (p.status === "paid") bucket(ukMonth(p.paidAt || p.dueDate)).paidPence += p.amountPence;
    else bucket(ukMonth(p.dueDate)).expectedPence += p.amountPence;
  }
  return [...months.values()]
    .filter((r) => (!from || r.month >= from) && (!to || r.month <= to))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Click-through rate as "1.23%", or "" when there is nothing to divide by. */
export function ctr(clicks, impressions) {
  if (!impressions || clicks == null) return "";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

/** Results summed across rows, ignoring blanks. */
export function totals(results) {
  const sum = (k) => results.reduce((s, r) => s + (r[k] || 0), 0);
  return { impressions: sum("impressions"), clicks: sum("clicks"), recipients: sum("recipients"), opens: sum("opens") };
}

export const fmtBytes = (n) =>
  n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
