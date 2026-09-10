// Check a roster before anyone writes to it, and say what is wrong with it.
//
// A harvested list is a set of claims, not a set of facts, and the failures are
// specific and repeatable rather than random:
//
//   a placeholder address a site never edited (example@mysite.com)
//   a colleague's address where the subject's was wanted
//   a domain that resolves but cannot receive mail
//   the same person found twice under two spellings of their job title
//   a person already in the interview pipeline
//
// Every one of those is cheap to detect and expensive to send to, so this runs
// between harvesting and sending. It writes a cleaned file and leaves the
// original alone, because a row this rejects is often still a lead worth
// chasing by hand.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
//     scripts/roster-check.mjs scripts/roster/golf.csv [--out=...clean.csv] [--no-mx]
//
// The MX check is the one that earns its place: it asks DNS whether the domain
// can receive mail at all, which no amount of reading a website will tell you,
// and it sends nothing.

import dns from "node:dns/promises";
import { readRoster, writeRoster, summarise, COLUMNS } from "./lib/roster.mjs";

const args = process.argv.slice(2);
const FILE = args.find((a) => !a.startsWith("--"));
const arg = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const NO_MX = args.includes("--no-mx");
const SKIP_DB = args.includes("--no-db");

if (!FILE) {
  console.error("usage: roster-check.mjs <roster.csv> [--out=clean.csv] [--no-mx] [--no-db]");
  process.exit(1);
}
const OUT = arg("out", FILE.replace(/\.csv$/, ".clean.csv"));

const rows = readRoster(FILE);
if (!rows.length) {
  console.error(`${FILE} is empty.`);
  process.exit(1);
}

// Placeholders and template addresses. These are live on real sites and read
// exactly like a find, which is why they need naming rather than eyeballing.
const PLACEHOLDER =
  /@(example|mysite|domain|yourdomain|yoursite|company|yourcompany|test|sample|email)\.|^(example|your|you|someone|name|firstname|user|username)@/i;

// Anyone already in the pipeline must not be harvested a second time.
let known = new Set();
if (!SKIP_DB) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const held = await prisma.interviewTarget.findMany({ select: { personName: true, email: true } });
    known = new Set([
      ...held.map((r) => (r.personName || "").toLowerCase()).filter(Boolean),
      ...held.map((r) => (r.email || "").toLowerCase()).filter(Boolean),
    ]);
    await prisma.$disconnect();
  } catch (e) {
    console.log(`(could not read the pipeline to de-duplicate: ${String(e.message).slice(0, 80)})`);
  }
}

// Resolving over HTTPS as well as over DNS, because in some sandboxes port 53
// is closed and every lookup fails with ECONNREFUSED. That is indistinguishable
// from "this domain cannot receive mail" at the call site, and the first version
// of this script duly rejected every row in the file including google.com. A
// check that cannot run has to say so rather than fail everything.
async function dohMx(domain) {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`doh ${r.status}`);
  const j = await r.json();
  // Status 0 is NOERROR. An empty Answer means the name exists but publishes no
  // MX, which is a different thing from the name not existing.
  if (j.Status !== 0) return false;
  return Array.isArray(j.Answer) && j.Answer.some((a) => a.type === 15);
}

let resolver = null; // "dns" | "doh" | null
async function pickResolver() {
  try {
    const mx = await dns.resolveMx("google.com");
    if (mx?.length) return "dns";
  } catch {}
  try {
    if (await dohMx("google.com")) return "doh";
  } catch {}
  return null;
}

const mxCache = new Map();
async function canReceiveMail(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  let ok = false;
  try {
    if (resolver === "dns") {
      const mx = await dns.resolveMx(domain);
      ok = Array.isArray(mx) && mx.length > 0;
      if (!ok) {
        // Some domains take mail on an A record, so this is checked second
        // rather than treated as proof on its own.
        const a = await dns.resolve4(domain);
        ok = Array.isArray(a) && a.length > 0;
      }
    } else {
      ok = await dohMx(domain);
    }
  } catch {
    ok = false;
  }
  mxCache.set(domain, ok);
  return ok;
}

let mxChecking = !NO_MX;
if (mxChecking) {
  resolver = await pickResolver();
  if (!resolver) {
    mxChecking = false;
    console.log("MX checking is OFF: neither DNS nor DNS-over-HTTPS answered a control lookup.\n");
  } else if (resolver === "doh") {
    console.log("MX checking over DNS-over-HTTPS, because port 53 is closed here.\n");
  }
}

// Harvesting a magazine's archive also picks up the magazine. BarberEVO's own
// editor reached the barbering list, which is a person we would be writing to
// about their own coverage. The source column records which publication the row
// came from, so the two can be compared.
const mainLabel = (h) => String(h || "").replace(/^www\./, "").split(".")[0].toLowerCase();
function isThePublication(row) {
  const pub = (row.source || "").match(/([a-z0-9-]+\.[a-z.]{2,})\s+archive/i)?.[1];
  if (!pub) return false;
  const label = mainLabel(pub);
  if (!label || label.length < 4) return false;
  const emailHost = (row.email || "").split("@")[1] || "";
  return mainLabel(emailHost) === label || mainLabel(row.domain) === label;
}

const reasons = new Map();
const reject = (row, why) => {
  reasons.set(why, (reasons.get(why) || 0) + 1);
  row._why = why;
  return false;
};

const seen = new Set();
const keep = [];
const dropped = [];

for (const row of rows) {
  const email = (row.email || "").trim().toLowerCase();
  const name = (row.name || "").trim();

  let ok = true;
  if (!name) ok = reject(row, "no person named");
  else if (!name.includes(" ")) ok = reject(row, "only one word of a name");
  else if (!email) ok = reject(row, "no address found");
  else if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) ok = reject(row, "not a valid address");
  else if (PLACEHOLDER.test(email)) ok = reject(row, "placeholder address");
  else if (known.has(name.toLowerCase()) || known.has(email)) ok = reject(row, "already in the pipeline");
  else if (seen.has(email)) ok = reject(row, "duplicate address in this file");
  else if (seen.has(name.toLowerCase())) ok = reject(row, "duplicate person in this file");
  else if (isThePublication(row)) ok = reject(row, "the publication we harvested, not a subject");

  if (ok && mxChecking) {
    const domain = email.split("@")[1];
    if (!(await canReceiveMail(domain))) ok = reject(row, "domain cannot receive mail");
  }

  if (ok) {
    seen.add(email);
    seen.add(name.toLowerCase());
    keep.push(row);
  } else {
    dropped.push(row);
  }
}

// Best first, so whoever works down the list spends their attention where it
// is least likely to be wasted. Confidence is not a score out of ten, it is
// three facts: whether the domain was published or worked out, whether the
// address is on that domain, and whether the address belongs to a person or to
// a room.
const confidence = (r) => {
  let c = 0;
  const s = r.source || "";
  if (/domain guessed/.test(s)) c += 2;
  if (/another domain/.test(s)) c += 3;
  const local = (r.email || "").split("@")[0];
  if (/^(info|hello|enquiries|contact|admin|office|reception|sales|support|mail)$/i.test(local)) c += 1;
  if (!r.role) c += 1;
  return c;
};
keep.sort((a, b) => confidence(a) - confidence(b) || a.name.localeCompare(b.name));

const CAP = Number(arg("cap", "0"));
const capped = CAP ? keep.slice(0, CAP) : keep;
writeRoster(OUT, capped);

const before = summarise(rows);
console.log(`${FILE}: ${rows.length} rows in, ${before.withName} named, ${before.withEmail} with an address.`);
// Reports what was written, not what survived the checks. Those differ once a
// cap is applied, and printing the larger number overstates the deliverable.
console.log(
  `${OUT}: ${capped.length} rows a person could be written to today` +
    `${CAP && keep.length > CAP ? `, capped from ${keep.length} usable` : ""}.\n`
);
if (reasons.size) {
  console.log("dropped:");
  for (const [why, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${why}`);
  }
}

// Rows rejected only for want of an address are still leads, so they are worth
// listing rather than losing.
const leads = dropped.filter((r) => r._why === "no address found" && r.name);
if (leads.length) {
  const leadsFile = OUT.replace(/\.csv$/, ".leads.csv");
  writeRoster(leadsFile, leads.map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c]]))));
  console.log(`\n${leads.length} named people have no address yet: ${leadsFile}`);
}
