// Work the guessed-address backlog with the contact hunter.
//
// `failed` on an OutreachEmail means the engine drafted the email, could not
// find a real address, guessed `press@<domain>`, and refused to send. That
// refusal is correct: a guess costs sending reputation when it bounces. But
// nothing ever revisits those rows, so they pile up. On 9 Sep 2026 there were
// 200 of them across the fleet, 103 on Airports alone, which is why Golf and
// Airports look like they have stopped working.
//
// This runs lib/contact-hunt.js over each one, which is a different and better
// thing than the fixed-path guess that failed originally: it follows the site's
// own contact and press navigation and decodes the usual obfuscations.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/requeue-guessed-addresses.mjs
//   ... --apply         write the results back (default is a dry run)
//   ... --site <slug>   one title only
//   ... --limit 50      stop after this many domains
//
// Three outcomes per row:
//   requeued   a real published address was found, row goes back to pending
//   dismissed  the target is one of our own titles, which is never outreach
//   left       the hunter found nothing, so it still needs a human
import { PrismaClient } from "@prisma/client";
import { huntContact } from "../lib/contact-hunt.js";

const APPLY = process.argv.includes("--apply");
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? null : process.argv[i + 1];
};
const ONLY = arg("site");
const LIMIT = Number(arg("limit") || 500);

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, name: true, slug: true } });
const byId = new Map(sites.map((s) => [s.id, s]));

// Our own domains. The engine has drafted outreach to barberingbusiness.com
// from Barbering Business three times over; those rows are not addresses to
// fix, they are articles that mentioned the title itself.
const creds = await prisma.siteCredential.findMany({ where: { kind: "outreach" }, select: { payloadEnc: true } });
const { decryptJson } = await import("../lib/crypto.js");
const ourDomains = new Set(
  creds
    .map((c) => {
      try {
        return decryptJson(c.payloadEnc)?.fromEmail?.split("@")[1]?.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean)
);

const where = { status: "failed" };
if (ONLY) {
  const s = sites.find((x) => x.slug === ONLY);
  if (!s) {
    console.error(`No title with slug "${ONLY}".`);
    process.exit(1);
  }
  where.siteId = s.id;
}

const rows = await prisma.outreachEmail.findMany({
  where,
  select: { id: true, siteId: true, brandName: true, contactEmail: true, brand: { select: { website: true } } },
});
console.log(`${rows.length} failed rows${APPLY ? "" : " (dry run)"}\n`);

const domainOf = (row) => {
  const fromBrand = row.brand?.website || "";
  const fromEmail = row.contactEmail || "";
  const host = fromBrand
    ? fromBrand.replace(/^https?:\/\//i, "").split("/")[0]
    : fromEmail.split("@")[1] || "";
  return host.replace(/^www\./i, "").toLowerCase();
};

// One hunt per domain, not per row: several titles can hold a row against the
// same company, and the hunter is a live fetch of somebody's website.
const byDomain = new Map();
for (const r of rows) {
  const d = domainOf(r);
  if (!d) continue;
  byDomain.set(d, [...(byDomain.get(d) || []), r]);
}
console.log(`${byDomain.size} distinct domains to look at\n`);

let requeued = 0;
let dismissed = 0;
let left = 0;
let looked = 0;

for (const [domain, group] of byDomain) {
  if (looked >= LIMIT) break;

  if (ourDomains.has(domain)) {
    console.log(`SELF      ${domain.padEnd(34)} ${group.length} row(s) — outreach to one of our own titles`);
    dismissed += group.length;
    if (APPLY) {
      await prisma.outreachEmail.updateMany({
        where: { id: { in: group.map((g) => g.id) } },
        data: { status: "dismissed", error: "Target is one of our own titles." },
      });
    }
    continue;
  }

  looked++;
  let found = null;
  try {
    found = await huntContact(domain);
  } catch (e) {
    console.log(`ERROR     ${domain.padEnd(34)} ${String(e.message || e).slice(0, 60)}`);
  }

  const email = found?.email?.toLowerCase();
  const guessed = (group[0].contactEmail || "").toLowerCase();

  // A hunt that returns the same guess is not a find. The row is only worth
  // requeueing when the address was actually seen written down somewhere.
  if (email && email !== guessed && found.confidence !== "guessed") {
    console.log(`FOUND     ${domain.padEnd(34)} ${email}  (${group.length} row(s))`);
    requeued += group.length;
    if (APPLY) {
      await prisma.outreachEmail.updateMany({
        where: { id: { in: group.map((g) => g.id) } },
        data: { status: "pending", contactEmail: found.email, error: null },
      });
    }
  } else {
    console.log(`no address ${domain.padEnd(33)} still needs a human (${group.length} row(s))`);
    left += group.length;
  }
}

console.log(
  `\n${APPLY ? "Requeued" : "Would requeue"} ${requeued}, dismissed ${dismissed} self-targeted, ${left} still need a human.` +
    (APPLY ? "" : "\nDry run only. Re-run with --apply to write.")
);
await prisma.$disconnect();
