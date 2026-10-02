"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Replace the header image with a photo chosen by hand.
//
// Shrunk in the browser before it is sent: a phone photo is often 5-10 MB and
// Vercel refuses a request over 4.5 MB, while 2400px is more than any header
// needs. The server normalises it again and puts it in the title's own
// WordPress media library (see uploadArticleImage).

const MAX_EDGE = 2400;

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export default function PhotoUploader({ articleId, action, currentAlt }) {
  const router = useRouter();
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pending, startTransition] = useTransition();

  const pick = (e) => {
    const f = e.target.files?.[0];
    setMsg(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = input.current?.files?.[0];
    if (!file) return setMsg({ error: "Choose a photo first." });
    startTransition(async () => {
      try {
        form.set("image", await shrink(file));
        const res = await action(form);
        if (!res?.ok) return setMsg({ error: res?.error || "Upload failed." });
        setMsg({ ok: "Photo uploaded to WordPress and set as the header image." });
        setPreview(null);
        if (input.current) input.current.value = "";
        router.refresh();
      } catch (err) {
        setMsg({ error: err.message });
      }
    });
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", borderRadius: 12, border: "1px dashed var(--line-bright)", marginBottom: 14 }}>
      <input type="hidden" name="id" value={articleId} />
      <div className="micro">Use your own photo</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" style={{ width: 180, maxHeight: 120, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
        )}
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={pending} />
          <input name="alt" placeholder="Alt text: what the photo shows" defaultValue={currentAlt || ""} disabled={pending} style={{ width: "100%" }} />
          <input name="credit" placeholder="Credit (optional), e.g. Photo: Emirates" disabled={pending} style={{ width: "100%" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn" disabled={pending || !preview}>
          {pending ? "Uploading…" : "Upload and use this photo"}
        </button>
        {msg?.ok && <span className="micro" style={{ color: "var(--neon-green)" }}>{msg.ok}</span>}
        {msg?.error && <span className="micro" style={{ color: "var(--neon-amber)" }}>{msg.error}</span>}
      </div>
    </form>
  );
}
