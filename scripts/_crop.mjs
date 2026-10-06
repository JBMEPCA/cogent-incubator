import sharp from "sharp";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const s = process.argv[2], top = Number(process.argv[3] || 0), h = Number(process.argv[4] || 1200);
await sharp(`${SP}/proof-${s}.png`).extract({ left: 0, top, width: 760, height: h }).resize({ width: 560 }).toFile(`${SP}/peek.png`);
console.log("ok");
