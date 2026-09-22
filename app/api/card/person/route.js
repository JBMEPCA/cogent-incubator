import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// The name card: what a story about a person leads with until a real photo of
// them turns up (lib/person-image.js, lib/headshots.js).
//
// Public, like api/brand: publish-due fetches it with a plain request to upload
// it to WordPress, with no session. It draws only what the query string says, in the title's
// own colours, so the worst anyone can do with it is make a card.
//
// No em dashes anywhere on it: house rule for every word we print.

function luminance(hex) {
  const m = String(hex || "").replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const clean = (s, n) => String(s || "").replace(/[–—]/g, ",").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const name = clean(q.get("name"), 60) || "Appointment";
  const role = clean(q.get("role"), 90);
  const org = clean(q.get("org"), 70);

  let site = null;
  try {
    site = await prisma.site.findUnique({
      where: { slug: String(q.get("site") || "") },
      select: { name: true, accentHex: true, accent2Hex: true },
    });
  } catch {
    site = null;
  }
  const bg = /^#[0-9a-f]{6}$/i.test(site?.accentHex || "") ? site.accentHex : "#1f2a44";
  const rule = /^#[0-9a-f]{6}$/i.test(site?.accent2Hex || "") ? site.accent2Hex : "#ffffff";
  const ink = luminance(bg) > 0.45 ? "#111111" : "#ffffff";
  const soft = ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.7)";

  const nameSize = name.length > 34 ? 96 : name.length > 24 ? 116 : 136;
  const line = [role, org].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: bg,
          color: ink,
          padding: "96px 110px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 72, height: 8, background: rule === bg ? ink : rule }} />
          <div style={{ fontSize: 34, letterSpacing: 8, textTransform: "uppercase", color: soft }}>People</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
          {line ? <div style={{ fontSize: 50, lineHeight: 1.25, color: soft, maxWidth: 1300 }}>{line}</div> : null}
        </div>
        <div style={{ display: "flex", fontSize: 32, letterSpacing: 4, textTransform: "uppercase", color: soft }}>
          {site?.name || ""}
        </div>
      </div>
    ),
    {
      width: 1600,
      height: 900,
      headers: { "cache-control": "public, max-age=86400" },
    }
  );
}
