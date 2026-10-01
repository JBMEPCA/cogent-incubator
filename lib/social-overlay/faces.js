// Face detection for the interview overlays.
//
// YuNet (OpenCV Zoo, MIT licence, 230 KB) run through onnxruntime-web's
// WebAssembly build. Chosen for where it runs: the posting job is a Vercel
// function, and the wasm runtime needs no native binary per platform, which is
// what rules out onnxruntime-node (300 MB unpacked) and tfjs-node. One
// inference on a 640 square takes well under a second on a single thread.
//
// Faces are only ever used to decide WHERE things go and whether a tag can be
// placed at all. Who a face belongs to is decided in placement.js from the
// caption, never from the picture.
import path from "node:path";
import sharp from "sharp";

const SIZE = 640;
const STRIDES = [8, 16, 32];
const SCORE_MIN = 0.75;
const NMS_IOU = 0.3;

const MODEL = path.join(process.cwd(), "lib/social-overlay/assets/face_detection_yunet_2023mar.onnx");

let sessionPromise = null;
async function session() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web");
      // Single-threaded: worker threads in a serverless function buy nothing
      // and are one more thing to fail on a cold start.
      ort.env.wasm.numThreads = 1;
      return ort.InferenceSession.create(MODEL);
    })().catch((e) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

/**
 * Every face in a picture, in the picture's own pixels, largest first.
 * Each face is { x, y, w, h, score, eyes: [[x,y],[x,y]] }.
 */
export async function detectFaces(input) {
  const img = sharp(input).rotate().removeAlpha();
  const { width, height } = await img.metadata().then((m) => orient(m));
  const scale = SIZE / Math.max(width, height);
  const rw = Math.round(width * scale);
  const rh = Math.round(height * scale);
  const { data } = await img
    .resize(rw, rh)
    .extend({ right: SIZE - rw, bottom: SIZE - rh, background: { r: 0, g: 0, b: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // NCHW, BGR, 0 to 255: the layout OpenCV's blobFromImage gives the model.
  const plane = SIZE * SIZE;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    tensor[i] = data[i * 3 + 2];
    tensor[plane + i] = data[i * 3 + 1];
    tensor[2 * plane + i] = data[i * 3];
  }

  const ort = await import("onnxruntime-web");
  const s = await session();
  const out = await s.run({ input: new ort.Tensor("float32", tensor, [1, 3, SIZE, SIZE]) });

  const found = [];
  for (const stride of STRIDES) {
    const cls = out[`cls_${stride}`].data;
    const obj = out[`obj_${stride}`].data;
    const box = out[`bbox_${stride}`].data;
    const kps = out[`kps_${stride}`].data;
    const cols = SIZE / stride;
    for (let i = 0; i < cls.length; i++) {
      const score = Math.sqrt(clamp01(cls[i]) * clamp01(obj[i]));
      if (score < SCORE_MIN) continue;
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cx = (c + box[i * 4]) * stride;
      const cy = (r + box[i * 4 + 1]) * stride;
      const w = Math.exp(box[i * 4 + 2]) * stride;
      const h = Math.exp(box[i * 4 + 3]) * stride;
      const eye = (n) => [((kps[i * 10 + n * 2] + c) * stride) / scale, ((kps[i * 10 + n * 2 + 1] + r) * stride) / scale];
      found.push({
        x: (cx - w / 2) / scale,
        y: (cy - h / 2) / scale,
        w: w / scale,
        h: h / scale,
        score,
        eyes: [eye(0), eye(1)],
      });
    }
  }
  return nms(found).sort((a, b) => b.w * b.h - a.w * a.h);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// sharp reports the stored size; .rotate() above applies EXIF orientation, so
// a portrait phone photo has its sides swapped.
function orient(m) {
  return m.orientation >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
}

export function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

function nms(boxes) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const b of sorted) if (!kept.some((k) => iou(k, b) > NMS_IOU)) kept.push(b);
  return kept;
}
