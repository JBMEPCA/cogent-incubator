// Kerry Phillips (The Ehlers Group, for Senior Resource Group) says we ran a
// stock building on the Carrington at Lincolnwood story and sent the real one.
// Her photo is 2000x1043, a 1.92 panorama; the featured slot wants 4:3 because
// the theme covers it to 16/9 for cards and 5/4 for the homepage hero.
//
// So crop to 4:3 around the community itself, then render what the theme will
// actually show so it can be looked at rather than assumed.
import sharp from "sharp";
import path from "node:path";

const SRC = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/images/6.jpg";
const OUT = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/carrington";

const meta = await sharp(SRC).metadata();
const H = meta.height;
const W4x3 = Math.round(H * 4 / 3);
// The buildings sit centre and centre-right; a centred crop keeps the complex
// and the Chicago skyline on the horizon.
const left = Math.round((meta.width - W4x3) / 2);
console.log(`source ${meta.width}x${meta.height} -> 4:3 crop ${W4x3}x${H} at x=${left} (drops ${meta.width - W4x3}px of width)`);

const featured = await sharp(SRC)
  .extract({ left, top: 0, width: W4x3, height: H })
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();
await sharp(featured).toFile(path.join(OUT, "carrington-lincolnwood.jpg"));
console.log(`featured ${W4x3}x${H}  ${(featured.length / 1024).toFixed(0)} KB`);

const card = Math.round(W4x3 * 9 / 16);
await sharp(featured)
  .extract({ left: 0, top: Math.round((H - card) / 2), width: W4x3, height: card })
  .toFile(path.join(OUT, "preview-card-16x9.jpg"));
console.log(`card     ${W4x3}x${card}`);

const heroW = Math.round(H * 5 / 4);
await sharp(featured)
  .extract({ left: Math.round((W4x3 - heroW) / 2), top: 0, width: heroW, height: H })
  .toFile(path.join(OUT, "preview-hero-5x4.jpg"));
console.log(`hero     ${heroW}x${H}`);
