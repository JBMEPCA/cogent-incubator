"use client";

import { startTransition, useActionState, useState } from "react";
import { uploadAssets } from "@/lib/campaign-actions";

// Upload the client's banners, logos and copy.
//
// Artwork is prepared in the browser before it is sent, because agencies send
// what they exported rather than what a site can serve. Miele's November 2026
// pack was the model: banners as PDFs (no browser shows a PDF in an <img>), a
// "300x250" GIF that was really 1920x1080 and 14 MB, a 1200x1000 JPG for a
// 300x250 slot. So:
//   - a PDF is drawn to a PNG at twice the slot size, ready to serve;
//   - a still image far larger than the slot is scaled down first;
//   - anything still over the 3.8 MB the server takes is refused here with the
//     reason, which is usually the message to send back to the client.

const MAX = 3.8 * 1024 * 1024;
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

async function pdfToPng(file, slot) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  // Twice the slot when we know it, otherwise twice the page's own size.
  const scale = slot ? (slot[0] * 2) / base.width : 2;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
}

async function imageSize(file) {
  const bmp = await createImageBitmap(file);
  const out = { width: bmp.width, height: bmp.height, bmp };
  return out;
}

async function shrink(file, bmp, maxW) {
  const ratio = maxW / bmp.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * ratio);
  canvas.height = Math.round(bmp.height * ratio);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.9));
  return new File([blob], file.name, { type });
}

export default function CampaignAssetUpload({ campaignId, deliverables }) {
  const [state, action, pending] = useActionState(uploadAssets.bind(null, campaignId), null);
  const [deliverableId, setDeliverableId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState([]);
  const slot = deliverables.find((d) => d.id === deliverableId)?.slot || null;

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const picked = [...form.elements.files.files];
    if (!picked.length) return;
    setBusy(true);
    const ready = [];
    const said = [];
    for (const f of picked) {
      try {
        if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          const png = await pdfToPng(f, slot);
          ready.push(png);
          said.push(`${f.name}: PDF converted to PNG`);
          continue;
        }
        if (/^image\//.test(f.type) && f.type !== "image/svg+xml") {
          const { width, height, bmp } = await imageSize(f);
          const limit = slot ? slot[0] * 2 : 2400;
          if (f.size > MAX && f.type === "image/gif") {
            said.push(
              `${f.name} NOT uploaded: an animated GIF of ${width}×${height} and ${mb(f.size)}. ${
                slot ? `A ${slot[0]}×${slot[1]} banner should be well under 200 KB;` : "That is far bigger than any banner;"
              } ask the client for one at the right size.`
            );
            continue;
          }
          if (width > limit && f.type !== "image/gif") {
            ready.push(await shrink(f, bmp, limit));
            said.push(`${f.name}: scaled from ${width}×${height} to ${limit} wide before upload`);
            continue;
          }
        }
        if (f.size > MAX) {
          said.push(`${f.name} NOT uploaded: ${mb(f.size)} is over the 3.8 MB limit. Add it as a link instead.`);
          continue;
        }
        ready.push(f);
      } catch (err) {
        said.push(`${f.name} NOT uploaded: could not be read (${String(err.message || err).slice(0, 80)})`);
      }
    }
    setNotes(said);
    setBusy(false);
    if (!ready.length) return;
    const fd = new FormData();
    ready.forEach((f) => fd.append("files", f));
    if (deliverableId) fd.set("deliverableId", deliverableId);
    startTransition(() => action(fd));
    form.reset();
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <form onSubmit={onSubmit} className="adv-inline">
        <input name="files" type="file" multiple required accept="image/*,application/pdf,.pdf,.html,.zip,.docx,.txt" style={{ flex: "2 1 240px" }} />
        {deliverables.length > 0 && (
          <select value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)} aria-label="For placement">
            <option value="">Whole campaign</option>
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-ghost" disabled={pending || busy}>
          {busy ? "Preparing…" : pending ? "Uploading…" : "Upload"}
        </button>
        <span className="micro" style={{ color: state ? (state.ok ? "var(--neon-green)" : "var(--neon-amber)") : "var(--muted)" }}>
          {state?.message || "PDFs become PNGs, oversized images are scaled. Pick the placement so artwork is sized to its slot."}
        </span>
      </form>
      {notes.length > 0 && (
        <ul className="micro camp-upload-notes">
          {notes.map((n) => (
            <li key={n} className={n.includes("NOT uploaded") ? "is-bad" : ""}>
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
