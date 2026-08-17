// Publishing schedule.
//
// Cadence: SEVEN slots a day, 90 minutes apart across the working day. Four a
// day is the floor and seven is the target, so the calendar is cut for seven
// and supply decides where between the two a given day lands. An unfilled slot
// costs nothing: fill-schedule simply skips it.
//
// This was four slots until 5 August, when the site managed one article in a
// day. Four slots was never the constraint, but it did cap the good days at
// four, and it left nowhere to put a backlog once one built up.
//
// Google rewards a steady, predictable stream far more than bursts, and
// staggered slots mean each post gets its own crawl and its own moment on the
// homepage and in social feeds. Nothing publishes after 16:30 so the last slot
// still clears well inside the 20:05 final cron of the day.
//
// Weekly mix (49 slots): 26 PR/news, 19 SEO originals, 4 case studies.
// Weighted towards news deliberately. Freshness gives the crawler a reason to
// come back, but the bigger reason is links: an article about a named company
// is one that company has a reason to share, and links are the one thing the
// site cannot write its way to. SEO originals are what ranks, so they hold the
// 10:30 and 13:30 slots every day. Case studies are the differentiator no
// competitor can copy, and they attract the advertisers we want.
//
// The type on a slot is a PREFERENCE, not a lock. See fill-schedule: if nothing
// of the right type is ready, the slot takes the best article that is, rather
// than standing empty. Two news slots sat empty on 5 August while nine finished
// SEO guides waited for a slot, which is the worst of both.
export const SLOTS = ["07:30", "09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];

/**
 * The slots ONE TITLE actually uses, from Site.articlesPerDayTarget.
 *
 * Seven was a constant in a shared file, which is the exact thing the
 * multi-tenant rebuild exists to end: an incubator title finding its feet wants
 * one or two a day, an established one wants seven, and neither should require
 * editing a module every other title imports.
 *
 * Sampled evenly across the day rather than taken from the front. Three
 * articles at 07:30, 09:00 and 10:30 is a burst followed by silence, and the
 * whole reason this file staggers at all is that a steady stream gives the
 * crawler a reason to come back and gives each post its own moment on the
 * homepage.
 */
export function slotsFor(site) {
  const wanted = Math.round(Number(site?.articlesPerDayTarget) || SLOTS.length);
  const n = Math.max(1, Math.min(SLOTS.length, wanted));
  if (n === SLOTS.length) return SLOTS;
  const step = SLOTS.length / n;
  return Array.from({ length: n }, (_, i) => SLOTS[Math.floor(i * step)]);
}

// Which type fills which slot, Monday to Sunday. Morning slots lean news
// (people read business news early); the middle of the day carries the ranking
// content; case studies sit midweek and at weekends where there is room.
export const WEEK_PLAN = {
  1: ["pr_rewrite", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original"], // Mon
  2: ["pr_rewrite", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original", "case_study", "pr_rewrite"], // Tue
  3: ["pr_rewrite", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original"], // Wed
  4: ["pr_rewrite", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original", "case_study", "pr_rewrite"], // Thu
  5: ["pr_rewrite", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original", "pr_rewrite", "seo_original"], // Fri
  6: ["pr_rewrite", "seo_original", "case_study", "seo_original", "pr_rewrite", "seo_original", "pr_rewrite"], // Sat
  0: ["pr_rewrite", "seo_original", "case_study", "seo_original", "pr_rewrite", "seo_original", "pr_rewrite"], // Sun
};

export const TYPE_LABEL = {
  pr_rewrite: "News",
  seo_original: "SEO guide",
  case_study: "Case study",
};

export const TYPE_STYLE = {
  pr_rewrite: { chip: "chip-brand", color: "#67e8f9" },
  seo_original: { chip: "chip-audience", color: "#6ee7b7" },
  case_study: { chip: "chip-content", color: "#c4b5fd" },
};

// Slot times are UK wall-clock times. The servers run in UTC, so convert
// explicitly: without this, everything publishes an hour late through BST.
const UK = "Europe/London";

// How many minutes ahead of UTC the UK is at that moment (0 or 60).
function ukOffsetMinutes(date) {
  const asUk = new Date(date.toLocaleString("en-US", { timeZone: UK }));
  const asUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((asUk - asUtc) / 60000);
}

// The UK calendar date, days ahead of now.
function ukDayParts(from, addDays) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: UK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const base = Date.UTC(get("year"), get("month") - 1, get("day"));
  return new Date(base + addDays * 86400000);
}

// All slots for the next `days` days, as {at, time, type, dayKey}.
// `at` is a real instant; `time` and `dayKey` are the UK-local labels.
export function upcomingSlots(site, days = 7, from = new Date()) {
  const out = [];
  const daySlots = slotsFor(site);
  for (let d = 0; d < days; d++) {
    const day = ukDayParts(from, d);
    const fullPlan = WEEK_PLAN[day.getUTCDay()];
    // WEEK_PLAN is written against all seven slots, so a title running fewer
    // takes the plan entry belonging to the slot it actually kept. Without this
    // a three-a-day title would get the first three types every day, which is
    // news, news, guide — and never a case study.
    const plan = daySlots.map((time) => fullPlan[SLOTS.indexOf(time)]);
    daySlots.forEach((time, i) => {
      const [h, m] = time.split(":").map(Number);
      // Build the instant as if UTC, then shift back by the UK offset.
      const naive = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m, 0, 0)
      );
      const at = new Date(naive.getTime() - ukOffsetMinutes(naive) * 60000);
      if (at <= from) return; // slot already gone today
      out.push({
        at,
        time,
        type: plan[i],
        dayKey: at.toLocaleDateString("en-GB", { timeZone: UK }),
      });
    });
  }
  return out;
}
