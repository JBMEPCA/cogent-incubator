// The engine's clock.
//
// GitHub Actions held this job and does not keep time: on a free private repo
// scheduled runs are dropped rather than queued, and the publishing engine
// managed 3 runs on 2 August against a cron asking for 15, then none at all
// before 08:42 the next morning. Cloudflare fires cron triggers on its own
// schedule, so this Worker exists purely to hit the endpoints GitHub was
// supposed to hit, on time.

// Which app the clock drives, and therefore the cutover switch.
//
// There is exactly ONE clock, so this is also what prevents the old
// single-title app and the fleet app both publishing to the same WordPress:
// moving the engine means repointing this, not running a second worker.
//
// No fallback. The default used to be the OLD app - deliberately, during the
// migration - which turned a wiped BASE_URL into nineteen silent hours of the
// cron ticking a dead deployment. A worker that does not know where its engine
// lives refuses to tick, loudly, instead of guessing.
const baseUrl = (env) => {
  if (!env.BASE_URL) throw new Error("BASE_URL is not set on this worker - refusing to tick the wrong app");
  return env.BASE_URL.replace(/[/]$/, "");
};

// Order matters. Publishing frees slots before the schedule is refilled, and
// the Director commissions before the worker goes looking for something to do.
//
// The two agent stages are deliberately separate requests. The Vercel function
// limit is a hard 60s and the Director alone costs 12-27s, which left too
// little for the Editor's 35-54s draft: on a combined tick it was killed every
// time. One request each means one full budget each.
//
// backlink-outreach only puts approved mail on the wire, which is cheap and
// wanted promptly. Finding mentions and chasing replies belong to the Backlink
// Manager and arrive through the agent stage above, so they are not listed here.
//
// The feed scan is listed twice on purpose. A Vercel invocation is capped at
// 60s and gets through roughly 15 sources, so the GitHub workflow always called
// it twice an hour and the second pass collects what the first ran out of time
// for. When the first has already drained the queue the second is cheap and
// adds nothing.
const STEPS = [
  "/api/cron/publish-due",
  "/api/cron/fill-schedule",
  "/api/cron/post-linkedin",
  "/api/cron/agents?stage=director",
  "/api/cron/agents?stage=worker",
  "/api/cron/backlink-outreach",
  // Link-win detection. The route throttles itself to once per title per 24h,
  // so the hourly call is a no-op thirteen times out of fourteen — but without
  // a caller it ran only when the Backlink Manager won its contended 12-hour
  // agent slot, and its own throttle was bypassed entirely.
  "/api/cron/check-backlinks",
  // The interview franchise. Reads the inbox, moves people to match what they
  // actually said, sends the questions to anyone who agreed and has waited, and
  // asks for the backlink a day after a piece goes live. Nothing watched this
  // queue at all before 1 Sep 2026: a row sat on "asked" whether the person had
  // ignored us or answered the same afternoon, and the first three replies were
  // only found because somebody went looking by hand. Hourly is right because
  // the delays are measured in hours, and a tick with nothing to do costs one
  // Gmail query.
  "/api/cron/interviews",
  "/api/cron/scan-feeds",
  "/api/cron/scan-feeds",
];

// Jobs that are not hourly. They live here rather than in a GitHub workflow for
// exactly the reason the hourly steps do: a weekly cron that silently does not
// fire is worse than no cron, and a missed Thursday is a missed issue.
//
// Gated on UK wall clock rather than UTC, the same way lib/agents/hours.js does
// it, so 09:05 stays 09:05 either side of the BST switch and this never needs
// touching twice a year. The hourly trigger spans 06:00-19:00 UTC, which covers
// UK 07:00, 09:00 and 19:00 in both BST and GMT. Any hour added here has to
// clear that window in GMT as well, or it will quietly never fire in winter.
const UK = "Europe/London";
const ukPart = (date, opts) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: UK, ...opts }).format(date);

function scheduledExtras(now) {
  const extra = [];
  const hour = Number(ukPart(now, { hour: "numeric", hour12: false }));
  const weekday = ukPart(now, { weekday: "short" }); // Mon, Tue, …

  // The SEO Analyst, at either end of the working day. Twice daily is what the
  // GitHub workflow asked for; its recommendations sit as pending suggestions
  // until JB approves them, so an extra sweep costs tokens and changes nothing
  // on its own. UK 07:00 and 19:00 both fall inside the 06:00-19:00 UTC trigger
  // window in BST and in GMT, which is why those two hours and not 06:00.
  if (hour === 7 || hour === 19) extra.push("/api/cron/seo-audit");

  // And the sweep that applies what the audit found, an hour behind each run
  // so it is working on a fresh list. Left unapplied, the suggestions banked
  // up to 807 by 25 August: the audit proposes about twenty links per title
  // per run, and nobody clicks twenty links a day for ever. Only the
  // mechanical kinds apply themselves; titles and copy still wait for a human.
  if (hour === 8 || hour === 20) extra.push("/api/cron/seo-apply");

  if (hour === 9) {
    // Chip away at verifying the Apollo list every morning.
    extra.push("/api/cron/subscriber-drip?mode=verify");

    // Import the next batch on Tuesdays, two clear days before the issue, so a
    // bad batch shows in the numbers before anything is sent to it.
    if (weekday === "Tue") extra.push("/api/cron/subscriber-drip?mode=import");

    // The weekly issue. Last in the list so the import and any publishing have
    // already happened by the time it picks its ten stories.
    //
    // Resumed 3 Aug 2026: news.smartsme.co.uk is verified and its DKIM records are
    // published. Safe to leave on even while Mailchimp finishes checking them,
    // because the route refuses to send from a domain that is not authenticated
    // and says so. The worst case is a skipped week, not a badly signed first send.
    if (weekday === "Thu") extra.push("/api/cron/newsletter");
  }

  return extra;
}

// The half-past tick, added 7 August 2026.
//
// It exists first for punctuality: four of the seven slots in lib/schedule.js
// sit on the half hour (07:30, 10:30, 13:30, 16:30) and an hourly clock could
// not reach them, so those articles went out 36 minutes late, which was 10 of
// the last 14 posts.
//
// It also lifts the throughput ceiling, which is the reason the calendar had no
// buffer at all. A tick runs the Director plus exactly ONE worker, and an
// article needs one tick to draft and another to source its image, so fourteen
// ticks a day capped output at seven articles against a calendar asking for
// seven. There was no slack anywhere, and one quiet day emptied the week.
// Twenty-eight ticks lifts the ceiling to about fourteen.
//
// Feed scanning is deliberately absent: the wire already holds 2,400 unread
// items, so scanning twice an hour would add cost and no content.
const HALF_PAST = [
  "/api/cron/publish-due",
  "/api/cron/fill-schedule",
  "/api/cron/post-linkedin",
  "/api/cron/agents?stage=director",
  "/api/cron/agents?stage=worker",
];

async function runAll(env, now = new Date(), steps = null) {
  const results = [];
  for (const path of steps || [...STEPS, ...scheduledExtras(now)]) {
    try {
      const res = await fetch(baseUrl(env) + path, {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      results.push({ path, status: res.status, body: (await res.text()).slice(0, 300) });
    } catch (e) {
      // One bad step must not take the rest down with it: a LinkedIn outage
      // should never be the reason an article failed to publish.
      results.push({ path, error: String(e).slice(0, 200) });
    }
  }

  // Tell a human. These results used to be collected and then discarded by the
  // scheduled handler, so a step failing every hour looked identical to a step
  // succeeding and the only sign of a dead sweep was silence. The app's alert
  // route dedupes (one email per failing step per few hours) and emails; the
  // POST is fire-and-fail-quietly because the alarm must never be what breaks
  // the engine — but its own failure is recorded in the results it reports on.
  // 524 means Cloudflare stopped waiting, not that anything broke. The agent
  // routes run to a 300s maxDuration by design and Cloudflare's patience is
  // about 100, so a busy fleet returns 524 while the work carries on and
  // finishes — on 26 August every title of the 09:35 tick completed minutes
  // after this alarm had already been emailed. Alerting on it trains the
  // reader to ignore the alerts, which costs more than the alert is worth.
  //
  // Nothing is hidden by this: an agent that genuinely fails records its own
  // failure against the run, and a tick that never arrives shows as no runs at
  // all. Both are read out of the database in the daily update.
  // Every route the app gives a 300s maxDuration outlives Cloudflare's ~100s
  // patience by design. Measured 26 August: the worker stage 94s, and
  // backlink-outreach 207s returning HTTP 200 while this worker had already
  // emailed to say it had failed. Naming them explicitly, so a NEW route that
  // starts timing out is still treated as the fault it probably is.
  const LONG_RUNNING = ["/api/cron/agents", "/api/cron/backlink-outreach", "/api/cron/newsletter", "/api/cron/seo-apply"];
  const stillWorking = (r) => r.status === 524 && LONG_RUNNING.some((path) => r.path.startsWith(path));
  const failures = results.filter((r) => (r.error || r.status >= 400) && !stillWorking(r));
  if (failures.length) {
    try {
      await fetch(baseUrl(env) + "/api/cron/alert", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: "cloudflare-worker", failures }),
      });
    } catch (e) {
      results.push({ path: "/api/cron/alert", error: String(e).slice(0, 200) });
    }
  }

  return results;
}

const handler = {
  async scheduled(event, env, ctx) {
    // waitUntil keeps the invocation alive for the whole chain. These endpoints
    // are slow by nature, but waiting on a subrequest is I/O rather than CPU,
    // which is what the free plan meters.
    //
    // Two triggers, told apart by event.cron: the hourly one runs the full
    // engine including the feed scan, the half-past one runs publishing and a
    // second agent tick.
    const halfPast = event.cron?.startsWith("35 ");
    ctx.waitUntil(runAll(env, new Date(event.scheduledTime), halfPast ? HALF_PAST : null));
  },

  // Manual trigger, the equivalent of GitHub's workflow_dispatch. Behind the
  // same secret, so knowing the URL is not enough to run the engine.
  async fetch(request, env) {
    if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    return Response.json(await runAll(env));
  },
};

export default handler;
