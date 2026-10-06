import { keyphraseInOpening } from "../lib/drafting.js";
const cases = [
  ["dental practice valuation", "A dental practice valuation in 2026 depends on turnover.", true],
  ["Dental Practice Valuation", "a  DENTAL   practice valuation guide", true],
  ["valuation practice dental", "A dental practice valuation in 2026", false],
  ["dental practice valuation", "x".repeat(800) + " dental practice valuation", false],
  ["dental practice valuation uk", "A dental practice valuation here", true],
  ["", "anything", false],
];
let bad = 0;
for (const [kp, text, want] of cases) {
  const got = keyphraseInOpening(kp, text);
  if (got !== want) { bad++; console.log("FAIL", JSON.stringify(kp), "->", got, "want", want); }
}
console.log(bad ? `${bad} failures` : "all 6 cases pass, same rule as QA");
