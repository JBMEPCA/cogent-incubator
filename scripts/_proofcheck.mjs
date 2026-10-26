import fs from "node:fs";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/proofs";
const links = JSON.parse(fs.readFileSync(`${SP}/links.json`, "utf8"));
for (const l of links) {
  try {
    const r = await fetch(l.direct, { redirect: "follow" });
    const t = await r.text();
    const imgs = (t.match(/<img /g)||[]).length;
    const broken = /undefined|\[object|src=""/.test(t);
    console.log(`${l.slug.padEnd(27)} ${r.status} ${String(Math.round(t.length/1024)+"KB").padStart(6)}  ${String(imgs).padStart(2)} images  ${broken ? "BROKEN VALUE" : "clean"}`);
  } catch (e) { console.log(`${l.slug.padEnd(27)} fetch failed ${e.message.slice(0,60)}`); }
}
