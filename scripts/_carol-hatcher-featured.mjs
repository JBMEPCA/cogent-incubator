// Carol Hatcher's headshot is 1086x1448, a 3:4 portrait. The theme covers the
// featured image into 16/9 for cards and 5/4 for the homepage hero, so a
// straight 4:3 crop of a tall portrait takes her mouth off in every card.
//
// So the portrait is placed whole on a 4:3 ground made from a blurred, enlarged
// copy of itself, sized so the 16/9 card window still holds her head and
// shoulders. Then both crops are rendered out so they can actually be looked
// at rather than assumed.
import sharp from "sharp";
import path from "node:path";

const DIR = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/shires-media";
const SRC = path.join(DIR, "image1.png");

const W = 1600;
const H = 1200;              // 4:3
const CARD = Math.round(W * 9 / 16);  // 900, the 16/9 window
const HERO = Math.round(W * 4 / 5);   // 1280 tall needed for 5/4, taller than H, so 5/4 trims the sides

// Her head and shoulders must sit inside the centred 16/9 band.
const inner = Math.round(CARD * 0.88);           // leaves air above the head in the 16/9 card
const top = Math.round((H - inner) / 2);         // centred in the frame

const bg = await sharp(SRC)
  .resize({ width: W, height: H, fit: "cover", position: "top" })
  .blur(40)
  .modulate({ brightness: 1.04, saturation: 0.7 })
  .toBuffer();

const person = await sharp(SRC).resize({ height: inner }).toBuffer();
const pm = await sharp(person).metadata();

const featured = await sharp(bg)
  .composite([{ input: person, top, left: Math.round((W - pm.width) / 2) }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();

await sharp(featured).toFile(path.join(DIR, "carol-hatcher-featured.jpg"));
const meta = await sharp(featured).metadata();
console.log(`featured  ${meta.width}x${meta.height}  ${(featured.length / 1024).toFixed(0)} KB  (person ${pm.width}x${pm.height} at top ${top})`);

// What the theme will actually show.
await sharp(featured)
  .extract({ left: 0, top: Math.round((H - CARD) / 2), width: W, height: CARD })
  .toFile(path.join(DIR, "preview-card-16x9.jpg"));
console.log(`card      ${W}x${CARD}  (16/9, the centre band)`);

const heroW = Math.round(H * 5 / 4);
await sharp(featured)
  .extract({ left: Math.round((W - heroW) / 2), top: 0, width: heroW, height: H })
  .toFile(path.join(DIR, "preview-hero-5x4.jpg"));
console.log(`hero      ${heroW}x${H}  (5/4, sides trimmed)`);
