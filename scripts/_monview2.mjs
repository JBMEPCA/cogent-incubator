import { readFileSync, writeFileSync } from "fs";
import { WORDMARKS } from "../lib/brand/wordmarks.js";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const slugs = ["smart-sme","fleet-magazine","golf-resort-magazine","barbering-business","airport-business-magazine","gym-business-news","nursery-daily","senior-lifestyle-business","dental-business-news","smart-farming-news"];
for (const s of slugs) {
  let html = readFileSync(`${SP}/mon2-${s}.html`, "utf8");
  const mark = WORDMARKS[s]?.masthead;
  if (mark) html = html.replace(/(utm_content=logo[^"]*"[^>]*>\s*<img src=")[^"]*(")/, `$1data:image/png;base64,${mark.toString("base64")}$2`);
  html = html.replace(/\*\|MC_PREVIEW_TEXT\|\*/g, "");
  html = html.replace(/src="(https:\/\/(?!wsrv\.nl)[^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi,
    (m, u) => `src="https://wsrv.nl/?url=${encodeURIComponent(u.replace(/^https:\/\//, ""))}&w=1200"`);
  writeFileSync(`${SP}/monview2-${s}.html`, html);
}
console.log("prepared", slugs.length);
