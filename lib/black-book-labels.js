// Short labels for the Black Book's title pills: a word and an emoji fits a
// row of eleven titles on one line where the full mastheads wrapped to three.
// Matched on the title's name so a renamed slug cannot break it; a title not
// listed here falls back to its full name.
const SHORT = [
  [/airport/i, "✈️", "Airport"],
  [/barber/i, "💈", "Barber"],
  [/dental/i, "🦷", "Dental"],
  [/golf/i, "⛳", "Golf"],
  [/gym/i, "🏋️", "Gym"],
  [/nursery/i, "🧸", "Nursery"],
  [/senior/i, "🏡", "Senior Living"],
  [/farm/i, "🚜", "Farming"],
  [/smart sme/i, "📈", "SME"],
  [/fleet/i, "🚚", "Fleet"],
  [/mepca/i, "🔧", "MEPCA"],
];

export function shortTitle(name = "") {
  const hit = SHORT.find(([re]) => re.test(name));
  return hit ? { emoji: hit[1], label: hit[2] } : { emoji: "📰", label: name };
}

// The day a date falls on in the UK, as YYYY-MM-DD so days compare as text.
const ukDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/**
 * Due means today or earlier, by the UK calendar. Follow-ups are stored at
 * 09:00 UTC on the day picked, so comparing instants made one due for today
 * look not due until ten in the morning.
 */
export function isDue(followUpDate, now = new Date()) {
  return !!followUpDate && ukDay(followUpDate) <= ukDay(now);
}

/**
 * Lucas, Oct 2026: follow-ups that are due go to the top, most overdue first.
 * Everything else keeps the order it came in (newest additions first).
 */
export function dueFirst(contacts, now = new Date()) {
  const due = contacts
    .filter((c) => isDue(c.followUpDate, now))
    .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
  return [...due, ...contacts.filter((c) => !isDue(c.followUpDate, now))];
}
