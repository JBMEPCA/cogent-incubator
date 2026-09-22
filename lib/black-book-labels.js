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
