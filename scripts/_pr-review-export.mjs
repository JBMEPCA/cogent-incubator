// Lucas's press desk review pack: one spreadsheet row per release a press@
// box received, and a saved copy of each email (body, pictures, attachments)
// for the row to link to, because Lucas cannot sign in to the titles' jb@
// mailboxes. Read-only against the database and Gmail.
//
//   node scripts/_pr-review-export.mjs <outDir>
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import JSZip from "jszip";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const OUT = process.argv[2];
if (!OUT) throw new Error("usage: node scripts/_pr-review-export.mjs <outDir>");
fs.mkdirSync(path.join(OUT, "emails"), { recursive: true });

const p = new PrismaClient();
const sites = await p.site.findMany();
const siteById = new Map(sites.map((s) => [s.id, s]));
const creds = await p.siteCredential.findMany({ where: { kind: "outreach" } });
const mailbox = new Map(creds.map((c) => [c.siteId, decryptJson(c.payloadEnc).fromEmail]));

const items = await p.feedItem.findMany({
  where: { link: { startsWith: "gmail:" }, NOT: { link: { startsWith: "gmail:dry-" } } },
  include: {
    articles: {
      select: { title: true, status: true, body: true, qaReport: true, wpPostId: true, publishedAt: true },
      orderBy: { createdAt: "desc" },
    },
  },
});

const uk = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Same reading of a held release as lib/press-desk.js holdReason() on main.
function holdReason(a) {
  if (!a) return "Held before drafting, usually an embargo whose time could not be read with certainty.";
  if (!a.body) return "Held before a draft was written.";
  let r;
  try { r = JSON.parse(a.qaReport || "{}"); } catch { return String(a.qaReport || "").slice(0, 400) || "Held by the quality gate."; }
  const faults = (r.mechanical || []).filter(Boolean).slice(0, 3).join(" ");
  return [r.summary, faults].filter(Boolean).join(" ").trim().slice(0, 600) || "Held by the quality gate, with no reason recorded.";
}

function verdict(item, site) {
  const a = item.articles.find((x) => x.status === "published") || item.articles[0] || null;
  const sum = String(item.summary || "");
  const skipped = sum.match(/^\[skipped: ([^\]]*)\]/m)?.[1]?.trim();
  if (a?.status === "published") {
    const url = site.domain && a.wpPostId ? `https://${site.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/?p=${a.wpPostId}` : null;
    const when = a.publishedAt > new Date() ? `Scheduled for ${uk(a.publishedAt)} as` : "Published as";
    return { used: "Yes", reason: `${when} "${a.title}"${url ? ` (${url})` : ""}`, articleUrl: url };
  }
  if (item.status === "dismissed") return { used: "No", reason: skipped ? `Not used: ${skipped}` : "Not used, with no reason recorded." };
  if (item.status === "shortlisted") return { used: "No", reason: `Held for a person to check, not published: ${holdReason(a)}` };
  return { used: "No", reason: "Still in progress when this was exported." };
}

// ---- Gmail -----------------------------------------------------------------
const tokens = new Map();
async function gmail(box, pathPart) {
  if (!tokens.has(box)) tokens.set(box, await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], box));
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${pathPart}`, { headers: { Authorization: `Bearer ${tokens.get(box)}` } });
  if (!res.ok) throw new Error(`Gmail ${res.status}`);
  return res.json();
}
const header = (m, name) => m.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value || "";
const charsetOf = (pt) => (pt.headers?.find((h) => h.name.toLowerCase() === "content-type")?.value.match(/charset="?([\w-]+)/i)?.[1] || "utf-8");
function decodeText(pt, buf) {
  try { return new TextDecoder(charsetOf(pt)).decode(buf); } catch { return buf.toString("utf8"); }
}
function walk(pt, f) { f(pt); (pt.parts || []).forEach((c) => walk(c, f)); }
const safeName = (s) => String(s || "file").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120);

async function snapshot(n, item, site, v) {
  const box = mailbox.get(site.id);
  const id = item.link.slice("gmail:".length);
  const dir = String(n).padStart(3, "0");
  const fileDir = path.join(OUT, "emails", dir);
  let msg = null;
  try { msg = await gmail(box, `/messages/${id}?format=full`); } catch {}

  let html = "", text = "";
  const files = [];
  const cids = new Map();
  if (msg) {
    const parts = [];
    walk(msg.payload, (pt) => parts.push(pt));
    for (const pt of parts) {
      if (pt.filename || pt.body?.attachmentId) {
        if (!pt.body?.attachmentId && !pt.body?.data) continue;
        const data = pt.body.attachmentId ? (await gmail(box, `/messages/${id}/attachments/${pt.body.attachmentId}`)).data : pt.body.data;
        let buf = Buffer.from(data, "base64url");
        let name = safeName(pt.filename || `inline-${files.length + 1}`);
        const isImage = pt.mimeType?.startsWith("image/") && !/svg/.test(pt.mimeType);
        if (isImage) {
          // Press photos arrive at full camera resolution. 1600px is plenty to
          // judge a picture by and keeps the pack shareable.
          try {
            buf = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
            name = name.replace(/\.[^.]+$/, "") + ".jpg";
          } catch {}
        }
        fs.mkdirSync(fileDir, { recursive: true });
        let finalName = name, k = 1;
        while (files.some((f) => f.name === finalName)) finalName = `${k++}-${name}`;
        fs.writeFileSync(path.join(fileDir, finalName), buf);
        const cid = pt.headers?.find((h) => h.name.toLowerCase() === "content-id")?.value?.replace(/[<>]/g, "");
        if (cid) cids.set(cid, `${dir}/${finalName}`);
        files.push({ name: finalName, href: `${dir}/${encodeURIComponent(finalName)}`, isImage, size: buf.length, inline: !!cid && !pt.filename, mime: pt.mimeType });
      } else if (pt.mimeType === "text/html" && pt.body?.data && !html) {
        html = decodeText(pt, Buffer.from(pt.body.data, "base64url"));
      } else if (pt.mimeType === "text/plain" && pt.body?.data && !text) {
        text = decodeText(pt, Buffer.from(pt.body.data, "base64url"));
      }
    }
  }

  let body;
  if (html) {
    body = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/cid:([^"'\s>)]+)/gi, (m, c) => (cids.get(c) ? encodeURI(cids.get(c)) : m));
  } else {
    const raw = text || String(item.summary || "").replace(/^\[(from|skipped|photo): [^\]]*\]\s*/gm, "");
    body = `<pre style="white-space:pre-wrap;font:15px/1.5 Arial,sans-serif">${esc(raw)}</pre>`;
  }

  const from = msg ? header(msg, "from") : String(item.summary || "").match(/^\[from: ([^\]]*)\]/m)?.[1] || "";
  const attachList = files.filter((f) => !f.inline);
  const tone = v.used === "Yes" ? "#047857" : "#b45309";
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(item.title)}</title>
<style>
body{margin:0;background:#f4f4f5;font:15px/1.5 Arial,sans-serif;color:#18181b}
.card{max-width:900px;margin:24px auto;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
.top{padding:18px 24px;border-bottom:1px solid #e4e4e7}
.top h1{font-size:20px;margin:0 0 10px}
.meta{font-size:13px;color:#52525b}.meta b{color:#18181b;display:inline-block;width:70px}
.verdict{margin:14px 0 0;padding:10px 14px;border-radius:8px;background:#fafafa;border-left:4px solid ${tone};font-size:14px}
.body{padding:20px 24px;overflow-x:auto}.body img{max-width:100%;height:auto}
.files{padding:16px 24px;border-top:1px solid #e4e4e7;background:#fafafa}
.files h2{font-size:14px;margin:0 0 10px}
.grid{display:flex;flex-wrap:wrap;gap:12px}.grid a{display:block;width:200px;font-size:12px;color:#18181b;text-decoration:none;word-break:break-all}
.grid img{width:200px;height:150px;object-fit:cover;border-radius:6px;border:1px solid #e4e4e7;display:block;margin-bottom:4px}
.doc{width:200px;height:150px;border-radius:6px;border:1px solid #e4e4e7;display:flex;align-items:center;justify-content:center;background:#fff;font-weight:bold;color:#52525b;margin-bottom:4px}
.warn{padding:12px 24px;background:#fef3c7;font-size:13px}
</style></head><body><div class="card">
<div class="top"><h1>${esc(msg ? header(msg, "subject") || item.title : item.title)}</h1>
<div class="meta"><b>Title</b>${esc(site.name)}<br><b>From</b>${esc(from)}<br><b>To</b>${esc(msg ? header(msg, "to") : "")}<br><b>Received</b>${esc(uk(item.publishedAt || item.discoveredAt))}</div>
<div class="verdict"><b>Was it used: ${v.used}.</b> ${esc(v.reason)}${v.articleUrl ? ` <a href="${esc(v.articleUrl)}" target="_blank">View the article</a>` : ""}</div></div>
${msg ? "" : `<div class="warn">This email is no longer in the ${esc(site.name)} mailbox. Below is the text the press desk kept when it read it; pictures and attachments were not kept.</div>`}
<div class="body">${body}</div>
${attachList.length ? `<div class="files"><h2>Attachments (${attachList.length})</h2><div class="grid">${attachList
    .map((f) => `<a href="${f.href}" target="_blank">${f.isImage ? `<img src="${f.href}" alt="">` : `<div class="doc">${esc((f.name.split(".").pop() || "file").toUpperCase())}</div>`}${esc(f.name)} · ${(f.size / 1024 / 1024).toFixed(1)} MB</a>`)
    .join("")}</div></div>` : ""}
</div></body></html>`;
  fs.writeFileSync(path.join(OUT, "emails", `${dir}.html`), page);
  return { href: `emails/${dir}.html`, found: !!msg, attachments: attachList.length };
}

// ---- Rows ------------------------------------------------------------------
const rows = items
  .map((item) => ({ item, site: siteById.get(item.siteId) }))
  .sort((a, b) => a.site.name.localeCompare(b.site.name) || new Date(b.item.publishedAt || b.item.discoveredAt) - new Date(a.item.publishedAt || a.item.discoveredAt));

const out = [];
let n = 0;
for (const { item, site } of rows) {
  n++;
  const v = verdict(item, site);
  const snap = await snapshot(n, item, site, v);
  out.push({ title: site.name, received: uk(item.publishedAt || item.discoveredAt), subject: item.title, href: snap.href, used: v.used, reason: v.reason, found: snap.found });
  if (n % 25 === 0) console.log(`${n}/${rows.length}`);
}

// ---- Spreadsheet (hand-written OOXML; no Python on this machine) -----------
const x = (s) => String(s ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const col = (i) => String.fromCharCode(65 + i);
const cell = (r, c, v, s) => `<c r="${col(c)}${r}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
const empty = (r, c, s) => `<c r="${col(c)}${r}" s="${s}"/>`;
// Styles: 0 default, 1 header, 2 wrapped body, 3 hyperlink, 4 Lucas input, 5 Yes, 6 No, 7 heading, 8 bold
const HEAD = ["Title", "Received", "The Email", "Was it Used", "Reasoning", "Lucas: right call?", "Lucas: why / what should have happened"];
const widths = [24, 18, 48, 11, 70, 16, 50];

const sheetRows = [`<row r="1" ht="30" customHeight="1">${HEAD.map((h, i) => cell(1, i, h, 1)).join("")}</row>`];
const links = [];
out.forEach((r, i) => {
  const rn = i + 2;
  links.push({ ref: `C${rn}`, target: r.href, id: `rId${i + 1}` });
  sheetRows.push(`<row r="${rn}">${[
    cell(rn, 0, r.title, 2), cell(rn, 1, r.received, 2),
    cell(rn, 2, r.found ? r.subject : `${r.subject} (text only)`, 3),
    cell(rn, 3, r.used, r.used === "Yes" ? 5 : 6), cell(rn, 4, r.reason, 2),
    empty(rn, 5, 4), empty(rn, 6, 4),
  ].join("")}</row>`);
});
const last = out.length + 1;
const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${sheetRows.join("")}</sheetData>
<autoFilter ref="A1:G${last}"/>
<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Pick from the list" error="Choose Agree, Should have been used, or Should not have been used." sqref="F2:F${last}"><formula1>"Agree,Should have been used,Should not have been used"</formula1></dataValidation></dataValidations>
<hyperlinks>${links.map((l) => `<hyperlink ref="${l.ref}" r:id="${l.id}" tooltip="Open the email as it arrived, with its pictures and attachments"/>`).join("")}</hyperlinks>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
const sheet1Rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links
  .map((l) => `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(l.target)}" TargetMode="External"/>`)
  .join("")}</Relationships>`;

const used = out.filter((r) => r.used === "Yes").length;
const guide = [
  ["How to review the press desk", 7],
  ["", 0],
  ["Every press release sent to a title's press@ address since the desk started (21 Sep 2026), and what the desk did with it.", 2],
  [`${out.length} releases: ${used} used, ${out.length - used} not used. Exported ${uk(new Date())}.`, 2],
  ["", 0],
  ["What to do", 8],
  ["1. Keep this spreadsheet and the emails folder together in the same folder. The links in The Email column open the saved copy of each email in your browser, with its pictures and attachments.", 2],
  ["2. Read the email, then the Reasoning column, which is what the press desk recorded when it decided.", 2],
  ["3. Fill in only the two yellow columns, F and G:", 2],
  ["     Lucas: right call?  Pick Agree, Should have been used, or Should not have been used.", 2],
  ["     Lucas: why  A line on your thinking. This is the useful part: it is what gets turned into rules for the desk.", 2],
  ["", 0],
  ["Example of a filled-in row", 8],
  ["Title: Golf Resort Magazine · Was it Used: No · Reasoning: Not used: relevance 4/10, a product launch for home golfers", 2],
  ["Lucas: right call? Should have been used · Lucas: why: Resort pro shops stock this brand, so our readers do buy it.", 2],
  ["", 0],
  ["Notes", 8],
  ["Was it Used = No covers two things: releases the desk turned down (Reasoning starts \"Not used\") and releases it held for a person to check (\"Held for a person to check\").", 2],
  ["Rows marked (text only) are emails that have since left the mailbox; the saved copy has the text the desk kept, without pictures.", 2],
  ["Use the filter arrows on the header row to look at one title, or only the No rows.", 2],
];
const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols><col min="1" max="1" width="140" customWidth="1"/></cols>
<sheetData>${guide.map(([t, s], i) => `<row r="${i + 1}">${t ? cell(i + 1, 0, t, s) : ""}</row>`).join("")}</sheetData>
</worksheet>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="6">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
<font><u/><sz val="10"/><color rgb="FF0563C1"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FF047857"/><name val="Arial"/></font>
<font><b/><sz val="14"/><name val="Arial"/></font>
<font><b/><sz val="10"/><name val="Arial"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E1"/></patternFill></fill>
</fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD4D4D8"/></left><right style="thin"><color rgb="FFD4D4D8"/></right><top style="thin"><color rgb="FFD4D4D8"/></top><bottom style="thin"><color rgb="FFD4D4D8"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="9">
<xf fontId="0"/>
<xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf fontId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="2" borderId="1" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="0" fillId="3" borderId="1" applyFill="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="3" borderId="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf fontId="5" fillId="4" borderId="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf fontId="4" applyFont="1"/>
<xf fontId="5" applyFont="1"/>
</cellXfs>
</styleSheet>`;

const zip = new JSZip();
zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Press releases" sheetId="1" r:id="rId1"/><sheet name="How to use" sheetId="2" r:id="rId2"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Press releases'!$A$1:$G$${last}</definedName></definedNames>
</workbook>`);
zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
zip.file("xl/styles.xml", styles);
zip.file("xl/worksheets/sheet1.xml", sheet1);
zip.file("xl/worksheets/_rels/sheet1.xml.rels", sheet1Rels);
zip.file("xl/worksheets/sheet2.xml", sheet2);
fs.writeFileSync(path.join(OUT, "Press desk review - Lucas.xlsx"), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

console.log({ rows: out.length, used, notFound: out.filter((r) => !r.found).length });
await p.$disconnect();
