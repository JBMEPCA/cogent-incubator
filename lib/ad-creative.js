import sharp from "sharp";
import { POSITIONS, positionInfo, sizesFor } from "./ad-positions";

// The copy of a creative the sites actually serve.
//
// Clients send what their agency exported: Miele's Golf MPU came as a
// 1200x1000 JPG at 569 KB for a 300x250 slot. Served as-is that is four times
// the pixels and several times the weight the slot needs, on every page view.
// So each upload gets a second copy: the original stays untouched in `data`
// for the client's records, and this one is resized to twice the slot (sharp
// on high-density screens, no bigger) and re-encoded.
//
// Format: WebP for the website (smaller, every current browser), but PNG, JPEG
// or GIF for email, because Outlook on Windows still cannot show WebP.

const EMAIL_KEYS = new Set(POSITIONS.filter((p) => p.email).map((p) => p.key));

/** The slot a creative is for: its placement's, or the one its shape matches. */
export function slotFor(position, width, height) {
  const sizes = position ? sizesFor(position) : POSITIONS.filter((p) => p.size).flatMap((p) => sizesFor(p.key));
  return sizes.find(([w, h]) => Math.abs(width / height - w / h) < 0.02 && width >= w && height >= h) || null;
}

/**
 * Returns { webData, webMime, webWidth, webHeight, webSize } or null when the
 * input is not an image sharp can read (which the upload then flags rather
 * than serving something broken).
 */
export async function makeWebCopy(buffer, { mimeType, position } = {}) {
  let meta;
  try {
    meta = await sharp(buffer, { animated: true, limitInputPixels: 1e8 }).metadata();
  } catch {
    return null;
  }
  const width = meta.width;
  const height = meta.pageHeight || meta.height;
  const animated = (meta.pages || 1) > 1;
  const slot = slotFor(position, width, height);
  // Twice the slot, never upscaled; an unrecognised shape is capped at 1200 wide.
  const targetW = slot ? Math.min(width, slot[0] * 2) : Math.min(width, 1200);

  let img = sharp(buffer, { animated, limitInputPixels: 1e8 });
  if (targetW < width) img = img.resize({ width: targetW });

  const forEmail = position ? EMAIL_KEYS.has(position) : false;
  let out;
  let mime;
  if (!forEmail) {
    out = await img.webp({ quality: 82, effort: 5 }).toBuffer({ resolveWithObject: true });
    mime = "image/webp";
  } else if (animated) {
    out = await img.gif().toBuffer({ resolveWithObject: true });
    mime = "image/gif";
  } else if (meta.hasAlpha) {
    out = await img.png({ compressionLevel: 9, palette: true }).toBuffer({ resolveWithObject: true });
    mime = "image/png";
  } else {
    out = await img.jpeg({ quality: 84, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    mime = "image/jpeg";
  }
  // Never ship something heavier than the original when nothing was resized.
  if (targetW === width && out.data.length > buffer.length && /^image\/(png|jpeg|gif|webp)$/.test(mimeType || "") && !(forEmail && mimeType === "image/webp")) {
    return { webData: buffer, webMime: mimeType, webWidth: width, webHeight: height, webSize: buffer.length };
  }
  return {
    webData: out.data,
    webMime: mime,
    webWidth: out.info.width,
    webHeight: out.info.pageHeight || out.info.height,
    webSize: out.data.length,
  };
}

export { positionInfo };
