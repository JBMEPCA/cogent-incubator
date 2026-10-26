/**
 * Topping up a title's drip queue from an Apollo export, without JB.
 *
 * Until October 2026 every top-up was a one-off script: Lucas sent a CSV, JB
 * asked Claude Code to rank it (scripts/rank-prospects.mjs), seed it
 * (scripts/seed-title-prospects.mjs) and check it. This does the same work
 * behind the upload box on /lists, one chunk at a time, so Lucas can top a
 * title up himself and the result is on the page when he has finished.
 *
 * What each chunk goes through, in order, cheapest first:
 *   1. no email, malformed email, duplicate in the chunk: dropped
 *   2. already in this title's queue (imported or not): dropped, never re-ranked
 *   3. Apollo says catch-all: kept but suppressed, same as the ranker
 *   4. verified bad or risky on ANY title: kept but suppressed, because the
 *      verdict is about the mailbox, not the magazine
 *   5. domain with no MX and no A record: kept but suppressed
 *   6. Claude reads job title, company and industry against the title's
 *      audience line and scores the fit 0-10; 3 and under is suppressed as
 *      off-title, which is what Tom's barber scrape needed doing by hand
 *
 * Suppressed rows are still written so the same person in next month's export
 * is recognised as a duplicate rather than judged again. Nothing here touches
 * Mailchimp: runDrip() remains the only thing that does, so the bounce gate and
 * the weekly allowance apply to Lucas's rows exactly as to everyone else's.
 */

import dns from "node:dns";
import Anthropic from "@anthropic-ai/sdk";
import { forSite, fleetRead } from "./prisma";
import { listSites, siteCredentials } from "./site";
import { mc } from "./newsletter";
import { prospectStats, isDripConfigured } from "./prospects";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODEL = "claude-haiku-4-5";
const SCORE_BATCH = 100;
const OFF_TITLE_AT = 3;

// ---- the upload log ----
//
// Per title, newest first, in EngineSetting rather than its own table: it is
// a short history for the page to show, not something anything queries, and a
// table would need a migration on the live database to hold twenty-five rows.
const UPLOADS_KEY = "lists.uploads";
const KEEP_UPLOADS = 25;

export async function getUploads(siteId) {
  const row = await forSite(siteId).engineSetting.findUnique({ where: { key: UPLOADS_KEY } });
  try {
    return JSON.parse(row?.value || "[]");
  } catch {
    return [];
  }
}

async function logChunk(siteId, upload, counts) {
  const all = await getUploads(siteId);
  let entry = all.find((u) => u.id === upload.id);
  if (!entry) {
    entry = { id: upload.id, at: new Date().toISOString(), by: upload.by, file: upload.file, rows: 0, added: 0, queued: 0 };
    all.unshift(entry);
  }
  for (const [k, v] of Object.entries(counts)) entry[k] = (entry[k] ?? 0) + v;
  entry.finishedAt = new Date().toISOString();
  const value = JSON.stringify(all.slice(0, KEEP_UPLOADS));
  await forSite(siteId).engineSetting.upsert({
    where: { key: UPLOADS_KEY },
    create: { key: UPLOADS_KEY, value },
    update: { value },
  });
  return entry;
}

// ---- scoring ----

// The ranker's seniority ladder, unchanged, so a top-up ranks on the same
// scale as the list it is joining.
function seniority(title = "") {
  const t = title.toLowerCase();
  if (/\b(owner|founder|ceo|chief executive|president|managing director|md)\b/.test(t)) return 30;
  if (/\b(director|head of|vp|vice president|chief \w+ officer|partner)\b/.test(t)) return 24;
  if (/\bmanager\b|\bmanagement\b/.test(t)) return 16;
  return 6;
}

const COUNTRY_NAMES = { GB: "United Kingdom", US: "United States", IE: "Ireland", AE: "United Arab Emirates" };

function baseScore(r, markets) {
  let s = seniority(r.title);
  const home = markets.map((m) => COUNTRY_NAMES[m] ?? m);
  if (r.country && r.country === home[0]) s += 10;
  else if (r.country && home.includes(r.country)) s += 5;
  // Ordering signals only, never proof: Apollo's flags were wrong for 11% of
  // Smart SME's first tranche.
  const verifiedAt = Date.parse(r.verifiedAt || "");
  if (verifiedAt) {
    const months = (Date.now() - verifiedAt) / (30 * 864e5);
    if (months <= 12) s += 8;
    else if (months <= 24) s += 4;
  }
  if (/zerobounce/i.test(r.verifySource || "")) s += 4;
  return s;
}

const FIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "fit"],
        properties: { i: { type: "integer" }, fit: { type: "integer" } },
      },
    },
  },
};

/**
 * Claude's read of how well each person fits the magazine, 0-10, keyed by the
 * row's position. Throws rather than returning partial scores: an unscored row
 * would go in unscreened, and the whole point of the box is that it screens.
 */
async function fitScores(site, rows) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();
  const system =
    `You screen B2B contacts for the email newsletter of ${site.name}, a trade magazine for: ` +
    `${site.audience || site.strapline || site.name}.\n\n` +
    "For each contact, score 0-10 how likely they are to find this newsletter relevant to their job. " +
    "10: works directly in the industry in a role the magazine is written for. " +
    "6-8: in the industry in a support role, or a decision-maker at a supplier to it. " +
    "3-5: tangential. 0-2: clearly unrelated (wrong industry, student, recruiter, generic mailbox at an unrelated firm). " +
    "Judge on job title, company, industry and keywords together. Return one score per contact, using its i.";

  const out = new Map();
  const batches = [];
  for (let b = 0; b < rows.length; b += SCORE_BATCH) batches.push(rows.slice(b, b + SCORE_BATCH).map((r, k) => [b + k, r]));

  await Promise.all(
    batches.map(async (batch) => {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        output_config: { format: { type: "json_schema", schema: FIT_SCHEMA } },
        system,
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              batch.map(([i, r]) => ({
                i,
                title: r.title ?? "",
                company: r.company ?? "",
                industry: r.industry ?? "",
                keywords: r.keywords ?? "",
                country: r.country ?? "",
              }))
            ),
          },
        ],
      });
      let text = "";
      for (const c of res.content) if (c.type === "text") text += c.text;
      const { scores } = JSON.parse(text.trim());
      for (const { i, fit } of scores) out.set(i, Math.max(0, Math.min(10, fit)));
      for (const [i] of batch) if (!out.has(i)) throw new Error(`Claude returned no score for row ${i}`);
    })
  );
  return out;
}

// ---- dead domains ----

const resolver = new dns.promises.Resolver({ timeout: 4000, tries: 1 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
const DEAD = new Set(["ENOTFOUND", "ENODATA"]);

/** Domains with neither MX nor A. Anything inconclusive gets the benefit of the doubt. */
async function deadDomains(domains) {
  const dead = new Set();
  const queue = [...domains];
  await Promise.all(
    Array.from({ length: 40 }, async () => {
      while (queue.length) {
        const d = queue.pop();
        try {
          await resolver.resolveMx(d);
        } catch (e) {
          if (!DEAD.has(e.code)) continue;
          try {
            await resolver.resolve4(d);
          } catch (e2) {
            if (DEAD.has(e2.code)) dead.add(d);
          }
        }
      }
    })
  );
  return dead;
}

// ---- the import ----

/**
 * One chunk of an upload. Safe to resend: everything already held is skipped,
 * so a chunk that failed half way can simply be sent again.
 */
export async function importChunk(site, rows, upload) {
  const db = forSite(site.id);
  const counts = { rows: rows.length, added: 0, queued: 0, badEmail: 0, dupes: 0, catchAll: 0, knownBad: 0, noMx: 0, offTitle: 0 };

  // 1. clean and dedupe within the chunk
  const byEmail = new Map();
  for (const r of rows) {
    const email = String(r.email || "").toLowerCase().trim();
    if (!EMAIL_RX.test(email)) { counts.badEmail++; continue; }
    if (byEmail.has(email)) { counts.dupes++; continue; }
    byEmail.set(email, { ...r, email });
  }

  // 2. already on this title
  const held = await db.newsletterProspect.findMany({
    where: { email: { in: [...byEmail.keys()] } },
    select: { email: true },
  });
  for (const { email } of held) byEmail.delete(email);
  counts.dupes += held.length;

  const fresh = [...byEmail.values()];
  if (!fresh.length) return { counts, upload: await logChunk(site.id, upload, counts) };

  // 4. verdicts already paid for, on any title
  const condemned = new Set(
    (
      await fleetRead().newsletterProspect.findMany({
        where: { email: { in: fresh.map((r) => r.email) }, verifyStatus: { in: ["bad", "risky", "invalid"] } },
        select: { email: true },
      })
    ).map((p) => p.email)
  );

  // 5 and 6 together: neither depends on the other
  const [dead, fits] = await Promise.all([
    deadDomains(new Set(fresh.map((r) => r.email.split("@")[1]))),
    fitScores(site, fresh),
  ]);

  const records = fresh.map((r, i) => {
    const domain = r.email.split("@")[1];
    const fit = fits.get(i);
    let suppressReason = null;
    if (/^catch-all$/i.test(r.catchAll || "")) { suppressReason = "apollo:catch-all"; counts.catchAll++; }
    else if (condemned.has(r.email)) { suppressReason = "verify:carried from another title"; counts.knownBad++; }
    else if (dead.has(domain)) { suppressReason = "no-mx"; counts.noMx++; }
    else if (fit <= OFF_TITLE_AT) { suppressReason = `claude:off-title (${fit}/10)`; counts.offTitle++; }

    return {
      siteId: site.id,
      email: r.email,
      firstName: r.firstName || null,
      lastName: r.lastName || null,
      title: r.title || null,
      company: r.company || null,
      companyCountry: r.country || null,
      domain,
      sic: (r.sic || "").slice(0, 64) || null,
      // Fit dominates: a relevant manager should go up before a senior person
      // Claude was lukewarm about.
      score: baseScore(r, site.markets ?? ["GB"]) + fit * 5,
      suppressed: Boolean(suppressReason),
      suppressReason,
    };
  });

  // Appended after everything already queued, best first. The queue is a
  // promise of order to the titles already waiting on it; a top-up joins the
  // back rather than reshuffling a ranking the earlier rows were promised.
  records.sort((a, b) => a.suppressed - b.suppressed || b.score - a.score);
  const top = (await db.newsletterProspect.aggregate({ _max: { rank: true } }))._max.rank ?? 0;
  records.forEach((rec, k) => { rec.rank = top + 1 + k; });

  const res = await db.newsletterProspect.createMany({ data: records, skipDuplicates: true });
  counts.added = res.count;
  counts.queued = records.filter((r) => !r.suppressed).length;
  return { counts, upload: await logChunk(site.id, upload, counts) };
}

// ---- the fleet view ----

/** Last time the drip pushed anything up for this title. */
async function lastImportAt(siteId) {
  const r = await forSite(siteId).newsletterProspect.aggregate({ _max: { importedAt: true } });
  return r._max.importedAt;
}

/**
 * Every title's list and queue, side by side. Mailchimp is read live and a
 * failure costs that one number, not the row.
 */
export async function listSizes() {
  const sites = await listSites();
  return Promise.all(
    sites.map(async (site) => {
      const { creds } = await siteCredentials(site.id);
      const audienceId = creds.mailchimp?.audienceId;
      const [members, stats, lastImport, uploads] = await Promise.all([
        audienceId
          ? mc(`/lists/${audienceId}?fields=stats.member_count`)
              .then((d) => d?.stats?.member_count ?? null)
              .catch(() => null)
          : null,
        prospectStats(site.id),
        lastImportAt(site.id),
        getUploads(site.id),
      ]);
      return {
        slug: site.slug,
        name: site.name,
        status: site.status,
        accentHex: site.accentHex,
        dripOn: isDripConfigured(creds.mailchimp),
        members,
        queued: stats.readyToImport,
        weeklyTarget: stats.weeklyTarget,
        importedThisWeek: stats.importedThisWeek,
        weeksRemaining: stats.weeksRemaining,
        imported: stats.imported,
        suppressed: stats.suppressed,
        lastImport,
        lastUpload: uploads[0] ?? null,
        uploads: uploads.slice(0, 5),
      };
    })
  );
}
