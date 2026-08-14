// Chip colors are light inks on translucent fills; `mark` is the validated
// dark-surface categorical step used for bars/charts.
export const STAGES = [
  { value: "prospect", label: "Prospect", color: "#b0bdd8", bg: "rgba(100,116,139,0.16)", mark: "#64748b" },
  { value: "contacted", label: "Contacted", color: "#67e8f9", bg: "rgba(8,145,178,0.16)", mark: "#0891b2" },
  { value: "in_talks", label: "In talks", color: "#c4b5fd", bg: "rgba(139,92,246,0.14)", mark: "#8b5cf6" },
  { value: "offer_sent", label: "Offer sent", color: "#fcd34d", bg: "rgba(217,119,6,0.14)", mark: "#d97706" },
  { value: "won", label: "Won", color: "#6ee7b7", bg: "rgba(5,150,105,0.16)", mark: "#059669" },
  { value: "lost", label: "Lost", color: "#fda4af", bg: "rgba(190,18,60,0.16)", mark: "#9f1239" },
];

export const PRODUCTS = [
  { value: "banner", label: "Web banner" },
  { value: "solus", label: "Solus e-shot" },
  { value: "web_story", label: "Web story" },
  { value: "newsletter", label: "Newsletter slot" },
  { value: "multiple", label: "Multiple" },
  { value: "other", label: "Other" },
];

export const OPEN_STAGES = ["prospect", "contacted", "in_talks", "offer_sent"];

export function stageInfo(value) {
  return STAGES.find((s) => s.value === value) || STAGES[0];
}

export function productLabel(value) {
  return PRODUCTS.find((p) => p.value === value)?.label || "—";
}

export function fmtMoney(v, perMonth) {
  if (v == null) return "—";
  return `£${v.toLocaleString("en-GB")}${perMonth ? "/mo" : ""}`;
}
