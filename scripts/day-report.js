// What the team did on a given day, and what it cost.
//
//   node scripts/day-report.js                        today, every title
//   node scripts/day-report.js 2026-08-03             a specific day
//   node scripts/day-report.js --vs 2026-08-03        today against that day
//   node scripts/day-report.js --site smart-sme       one title only
//
// Written because comparing two days by hand invites picking whichever numbers
// flatter the answer. The same query runs for both, so a comparison is honest
// by construction.
//
// Spend comes from two places and must include both: AgentRun covers the agent
// pipeline, Article.costUsd covers anything the batch publisher made. Counting
// only the first understated cost per article fourfold.
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(String.fromCharCode(10))) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  const q = v[0];
  if ((q === String.fromCharCode(34) || q === String.fromCharCode(39)) && v.endsWith(q)) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// The daily target is READ FROM Site.articlesPerDayTarget, per title, every run.
//
// It used to be a hardcoded 7 mirroring SLOTS.length. That was wrong twice over
// once the fleet arrived: Smart SME had been moved to 1 a day and then 3, and
// Fleet Magazine runs at 1, so a report saying "2 of 7" was measuring against a
// cadence nothing was aiming at — and on 17 August, with no site filter either,
// it read "12 of 3" because it was counting both titles' output against one
// title's target.
//
// The target is expected to change often, so nothing here may cache or restate
// it. It is fetched with the site row and used exactly as stored.
const USD_TO_GBP = 0.79;

// The UK calendar day, because the schedule and the operating hours are both UK
// wall clock. Using the server's local midnight would split a day in the wrong
// place through BST.
function ukDayBounds(dateStr) {
  const day =
    dateStr ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const start = new Date(`${day}T00:00:00Z`);
  const offsetMin = Math.round(
    (new Date(start.toLocaleString("en-US", { timeZone: "Europe/London" })) -
      new Date(start.toLocaleString("en-US", { timeZone: "UTC" }))) /
      60000
  );
  const from = new Date(start.getTime() - offsetMin * 60000);
  return { day, from, to: new Date(from.getTime() + 864e5) };
}

async function gather(dateStr, site) {
  const { day, from, to } = ukDayBounds(dateStr);
  const window = { gte: from, lt: to };
  // Every query is scoped to one title. Without this the fleet's totals were
  // pooled and then divided by one title's article count, so cost per article
  // was wrong for every title at once.
  const siteId = site.id;

  const [runs, published, topics, linkedIn, outreach, messages] = await Promise.all([
    prisma.agentRun.findMany({
      where: { siteId, startedAt: window },
      select: { agentKey: true, ok: true, costUsd: true, error: true, summary: true },
    }),
    prisma.article.findMany({
      where: { siteId, publishedAt: window },
      select: { title: true, type: true, wpPostId: true, costUsd: true, seoScore: true, body: true },
    }),
    prisma.researchTopic.findMany({ where: { siteId, createdAt: window }, select: { status: true } }),
    prisma.linkedInPost.count({ where: { siteId, createdAt: window } }),
    prisma.outreachEmail.count({ where: { siteId, createdAt: window } }),
    prisma.agentMessage.count({ where: { siteId, createdAt: window } }),
  ]);

  const byAgent = {};
  for (const r of runs) {
    const b = (byAgent[r.agentKey] = byAgent[r.agentKey] || { runs: 0, fail: 0, cost: 0 });
    b.runs += 1;
    if (!r.ok) b.fail += 1;
    b.cost += r.costUsd || 0;
  }

  const agentCost = runs.reduce((s, r) => s + (r.costUsd || 0), 0);
  const scriptedCost = published.reduce((s, a) => s + (a.costUsd || 0), 0);
  const failedRuns = runs.filter((r) => !r.ok);

  // Work that finished but produced nothing usable. A run that succeeds and
  // yields no topic, no draft and no image is spend either way, and is the
  // number that actually moved when the duplicate loop was fixed.
  const barren = runs.filter(
    (r) =>
      r.ok &&
      /Proposed 0|queue empty|already has an image|No image passed|Nothing to|nothing to arbitrate|Team on track/i.test(
        r.summary || ""
      )
  );

  const words = published.reduce(
    (s, a) => s + (a.body ? a.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length : 0),
    0
  );

  return {
    day,
    site: site.slug,
    siteName: site.name,
    // Carried on the result, not read at render time, so a comparison between
    // two days is always drawn against the target each of those days was
    // actually judged by.
    target: site.articlesPerDayTarget,
    isToday: day === new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()),
    runs: runs.length,
    failed: failedRuns.length,
    failReasons: failedRuns.reduce((m, r) => {
      // Collapsed before slicing: Prisma errors are multi-line, and a raw slice
      // put a newline in the middle of a report column.
      const k = String(r.error || "unknown").replace(/\s+/g, " ").trim().slice(0, 50);
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {}),
    barren: barren.length,
    barrenCost: barren.reduce((s, r) => s + (r.costUsd || 0), 0),
    byAgent,
    agentCost,
    scriptedCost,
    totalCost: agentCost + scriptedCost,
    published: published.length,
    publishedList: published,
    words,
    perArticle: published.length ? (agentCost + scriptedCost) / published.length : null,
    topicsProposed: topics.length,
    topicsKept: topics.filter((t) => t.status === "proposed").length,
    linkedIn,
    outreach,
    messages,
  };
}

const money = (usd) => `$${usd.toFixed(2)} (£${(usd * USD_TO_GBP).toFixed(2)})`;

function render(d) {
  console.log(`\n=== ${d.siteName} · ${d.day} ===`);
  const short = d.target != null && d.published < d.target ? `  (${d.target - d.published} short)` : "";
  // Flagged on any past day, because the target read here is today's and the
  // setting is not historised. See compare().
  const asOf = d.isToday ? "" : " (today's setting)";
  console.log(
    `Published        ${d.published} of ${d.target ?? "?"} target${asOf}${d.words ? `, ${d.words.toLocaleString()} words` : ""}${short}`
  );
  d.publishedList.forEach((a) => console.log(`                 wp${a.wpPostId || "-"} ${a.type} ${a.title.slice(0, 52)}`));
  console.log(`Cost             ${money(d.totalCost)}${d.scriptedCost ? ` (agents ${money(d.agentCost)} + scripted ${money(d.scriptedCost)})` : ""}`);
  if (d.perArticle) console.log(`Per article      ${money(d.perArticle)}`);
  console.log(`Runs             ${d.runs}, ${d.failed} failed, ${d.barren} produced nothing (${money(d.barrenCost)})`);
  Object.entries(d.failReasons).forEach(([e, n]) => console.log(`                 ${n}x ${e}`));
  console.log(`Topics           ${d.topicsProposed} proposed, ${d.topicsKept} survived dedupe`);
  console.log(`Drafts queued    ${d.linkedIn} LinkedIn, ${d.outreach} outreach`);
  console.log("By agent:");
  Object.entries(d.byAgent)
    .sort((a, b) => b[1].cost - a[1].cost)
    .forEach(([k, v]) =>
      console.log(`  ${k.padEnd(11)}${String(v.runs).padStart(3)} runs${v.fail ? `, ${v.fail} failed` : "        "}  $${v.cost.toFixed(3)}`)
    );
}

function compare(now, then) {
  const line = (label, a, b, fmt = (x) => x, betterHigher = true) => {
    const delta = a - b;
    const arrow = delta === 0 ? "same" : `${delta > 0 ? "+" : ""}${fmt(delta)}`;
    const good = delta === 0 ? " " : (delta > 0) === betterHigher ? "▲" : "▼";
    console.log(`  ${label.padEnd(18)}${String(fmt(a)).padStart(10)}${String(fmt(b)).padStart(12)}${arrow.padStart(12)}  ${good}`);
  };
  console.log(`\n=== ${now.siteName} · ${now.day} vs ${then.day} ===`);
  console.log(`  ${"".padEnd(18)}${now.day.slice(5).padStart(10)}${then.day.slice(5).padStart(12)}${"change".padStart(12)}`);
  line("published", now.published, then.published);
  // Site.articlesPerDayTarget holds ONE value: the current one. There is no
  // history, so both days above are scored against today's setting and this
  // cannot detect that the older day was aiming at something else.
  //
  // Smart SME ran at seven a day, then one, then three, all within a week. A
  // report that quietly compares a seven-a-day day against a three-a-day target
  // reads as a collapse in output. Say which number is being used and leave the
  // reader to apply what they know; inventing a historical target would be
  // worse than admitting there isn't one.
  console.log(`  both days scored against today's target of ${now.target}/day, which is the only one stored`);
  line("cost usd", now.totalCost, then.totalCost, (x) => x.toFixed(2), false);
  line("runs", now.runs, then.runs, (x) => x, false);
  line("failed runs", now.failed, then.failed, (x) => x, false);
  line("barren runs", now.barren, then.barren, (x) => x, false);
  line("wasted usd", now.barrenCost, then.barrenCost, (x) => x.toFixed(2), false);
  line("topics kept", now.topicsKept, then.topicsKept);
  line("outreach drafts", now.outreach, then.outreach);
  if (now.perArticle && then.perArticle)
    line("per article", now.perArticle, then.perArticle, (x) => x.toFixed(3), false);
}

(async () => {
  const args = process.argv.slice(2);
  const vsIndex = args.indexOf("--vs");
  const baseline = vsIndex >= 0 ? args[vsIndex + 1] : null;
  const siteIndex = args.indexOf("--site");
  const wantSite = siteIndex >= 0 ? args[siteIndex + 1] : null;
  const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a) && a !== baseline) || null;

  const sites = await prisma.site.findMany({
    where: wantSite ? { slug: wantSite } : {},
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, name: true, articlesPerDayTarget: true },
  });
  if (!sites.length) {
    console.error(wantSite ? `no title with slug "${wantSite}"` : "no titles found");
    process.exit(1);
  }

  // One report per title, never a fleet total. Two titles on different cadences
  // pooled into one number tells you nothing about either of them.
  for (const site of sites) {
    const now = await gather(day, site);
    render(now);
    if (baseline) {
      const then = await gather(baseline, site);
      render(then);
      compare(now, then);
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("FAILED", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
