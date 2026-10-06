import sharp from "sharp";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
for (const s of ["smart-sme", "fleet-magazine", "golf-resort-magazine", "barbering-business", "airport-business-magazine"]) {
  const src = `${SP}/shot-${s}.png`;
  const img = sharp(src);
  const { width, height } = await img.metadata();
  // Find the last row that is not the page's flat background, so a 5,600px
  // canvas is cut back to the email's real length.
  const raw = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const ch = info.channels;
  const at = (x, y) => { const i = (y * info.width + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
  const bg = at(2, info.height - 2);
  let last = info.height - 1;
  for (let y = info.height - 1; y >= 0; y--) {
    let differs = false;
    for (let x = 0; x < info.width; x += 4) {
      const p = at(x, y);
      if (Math.abs(p[0] - bg[0]) > 6 || Math.abs(p[1] - bg[1]) > 6 || Math.abs(p[2] - bg[2]) > 6) { differs = true; break; }
    }
    if (differs) { last = y; break; }
  }
  const cut = Math.min(info.height, last + 40);
  await sharp(src).extract({ left: 0, top: 0, width, height: cut }).png({ compressionLevel: 9 }).toFile(`${SP}/proof-${s}.png`);
  console.log(s, `${width}x${height} -> ${width}x${cut}`);
}
