// The time filter on the home page and Group analytics: Today, 7D, 1M, All
// time. Pages read it from ?period= so a view can be linked to, and it changes
// the numbers that measure a stretch of time (traffic, spend, output). Things
// that are a month by definition, like the targets, stay a month.
//
// No server imports, so the filter control can use it too.

export const PERIODS = [
  { key: "today", label: "Today", days: 1, phrase: "today" },
  { key: "7d", label: "7D", days: 7, phrase: "the last 7 days" },
  { key: "1m", label: "1M", days: 30, phrase: "the last 30 days" },
  { key: "all", label: "All time", days: null, phrase: "all time" },
];

export const DEFAULT_PERIOD = "1m";

export function periodFrom(value) {
  return PERIODS.find((p) => p.key === value) || PERIODS.find((p) => p.key === DEFAULT_PERIOD);
}

/** Start of the period: midnight UK time for Today, N days back otherwise, null for all time. */
export function periodStart(period, now = new Date()) {
  if (period.key === "all") return null;
  if (period.key === "today") {
    // Midnight in London, whatever the server's own clock zone.
    const ymd = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const utcMidnight = new Date(`${ymd}T00:00:00Z`);
    const offsetH = Number(
      utcMidnight.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })
    );
    return new Date(utcMidnight.getTime() - (offsetH % 24) * 3600e3);
  }
  return new Date(now.getTime() - period.days * 864e5);
}
