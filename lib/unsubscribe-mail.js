// Mailto unsubscribes, read and honoured.
//
// Every outreach mail carries `List-Unsubscribe: <mailto:jb@<title>?subject=unsubscribe>`
// (lib/gmail.js), and interview mail carries ONLY that mailto, with no one-click
// URL. Apple Mail, Outlook and others honour it by sending a bare message titled
// "unsubscribe" to the title mailbox. Until 2 Nov 2026 nothing read those: the
// inbox triage filed them as Noise, and three people who had asked to be left
// alone stayed on the lists (Core The Gym, Holme Dentistry, notjust), one of them
// for nearly a month.
//
// The opt-out goes into the fleet-wide OutreachOptOut table, which the backlink
// send path already checks and the interview send path now checks too. Its key
// is a DOMAIN, except for free-mail senders: opting out gmail.com because one
// gym owner on Gmail unsubscribed would silence every other gym owner on Gmail,
// so for those the full address is stored in the same column.

import { prisma } from "./prisma";
import { inboundMatching, isGmailConfigured } from "./gmail";

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.co.uk",
  "live.com", "live.co.uk", "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com",
  "me.com", "mac.com", "aol.com", "aol.co.uk", "btinternet.com", "sky.com", "virginmedia.com",
  "talktalk.net", "protonmail.com", "proton.me", "gmx.com", "gmx.co.uk", "mail.com", "zoho.com",
]);

export function bareAddress(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim().toLowerCase();
}

export function domainOfAddress(email) {
  return String(email || "").split("@")[1]?.trim().toLowerCase() || null;
}

export function isFreeMail(email) {
  return FREE_MAIL.has(domainOfAddress(email));
}

/** The OutreachOptOut key for a sender: their domain, or the whole address on free mail. */
export function optOutKey(email) {
  const addr = bareAddress(email);
  const domain = domainOfAddress(addr);
  if (!domain) return null;
  return FREE_MAIL.has(domain) ? addr : domain;
}

/**
 * Has this address opted out, under either key? `extraDomains` lets a caller add
 * the company's website domain, so a person writing from a different address at
 * the same firm is still covered.
 */
export async function isOptedOut(email, extraDomains = []) {
  const addr = bareAddress(email);
  const keys = [...new Set([addr, domainOfAddress(addr), ...extraDomains.map((d) => String(d || "").toLowerCase())].filter(Boolean))]
    // Never match on a bare free-mail domain, even if one slipped into the table.
    .filter((k) => k.includes("@") || !FREE_MAIL.has(k));
  if (!keys.length) return null;
  return prisma.outreachOptOut.findFirst({ where: { domain: { in: keys } } });
}

// What a mailto unsubscribe looks like. The subject is the one we put in the
// header; "Re:" covers clients that reply rather than compose. A person who
// writes "please unsubscribe me" by hand is a human reply, read by the interview
// classifier or by JB, and deliberately not swallowed here.
export function isUnsubscribeRequest(msg) {
  return /^\s*(re:\s*)?unsubscribe\s*$/i.test(String(msg?.subject || ""));
}

/**
 * Find mailto unsubscribes in one title's outreach mailbox and honour them.
 * Idempotent: a sender already in OutreachOptOut is reported, not rewritten.
 *
 * Declines any InterviewTarget on THIS title that is still waiting on the
 * person (by address, or by company domain for non-free-mail senders), so the
 * sweep stops chasing them. Published rows are left alone; the send guard
 * stops their backlink ask.
 */
export async function processUnsubscribes(site, { db, outreach, foreignAddresses = [], dryRun = false, days = 60 }) {
  if (!isGmailConfigured(outreach)) return { skipped: "gmail not configured", found: [] };
  const own = String(outreach?.fromEmail || "").toLowerCase();
  // Same reason as the interview sweep: Smart SME's mailbox holds forwarded
  // copies of every other title's mail. Those belong to the title they were
  // sent to, which will find them in its own mailbox.
  const notForUs = foreignAddresses
    .filter((a) => a && a.toLowerCase() !== own)
    .map((a) => `-to:${a}`)
    .join(" ");
  const mail = await inboundMatching(outreach, `-from:me newer_than:${days}d subject:unsubscribe ${notForUs}`.trim(), 50);

  const found = [];
  for (const msg of mail.filter(isUnsubscribeRequest)) {
    const email = bareAddress(msg.from);
    const key = optOutKey(email);
    if (!key || email === own) continue;
    const domain = domainOfAddress(email);
    const free = isFreeMail(email);

    const existing = await prisma.outreachOptOut.findUnique({ where: { domain: key } });
    const open = await db.interviewTarget.findMany({
      where: {
        siteId: site.id,
        status: { in: ["pending", "asked", "agreed", "questioned", "answered"] },
        OR: [{ email: { equals: email, mode: "insensitive" } }, ...(free ? [] : [{ email: { endsWith: `@${domain}`, mode: "insensitive" } }, { companyDomain: domain }])],
      },
      select: { id: true, personName: true, company: true, status: true },
    });

    const when = msg.date ? new Date(msg.date) : new Date();
    found.push({ from: email, key, at: when.toISOString(), alreadyOptedOut: Boolean(existing), declines: open.map((t) => `${t.personName} (${t.company}, ${t.status})`) });
    if (dryRun) continue;

    if (!existing) {
      await prisma.outreachOptOut.create({
        data: { domain: key, brandName: open[0]?.company || null, sourceSite: site.slug, optedOutAt: when, note: `mailto unsubscribe from ${email}, message ${msg.id}` },
      });
    }
    for (const t of open) {
      await db.interviewTarget.update({
        where: { id: t.id },
        data: { status: "declined", declinedAt: when, error: `unsubscribed by email (mailto) ${when.toISOString().slice(0, 10)}` },
      });
    }
  }
  return { found };
}
