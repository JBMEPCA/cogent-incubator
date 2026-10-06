/** List images embedded in a .docx attachment on a Gmail message, in memory. Usage: node ... <messageId> <attachment filename substring> */
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client"; import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js"; import { getGoogleAccessToken } from "../lib/google.js";
const [msgId, needle] = process.argv.slice(2);
const prisma = new PrismaClient(); const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug)); const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])); const sender = outreachSender(creds.outreach); await prisma.$disconnect();
const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email); const H = { Authorization: `Bearer ${t}` };
const d = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, { headers: H }).then((r) => r.json());
let att; (function walk(p) { if (p.filename && p.filename.includes(needle) && p.body?.attachmentId) att = p; for (const c of p.parts || []) walk(c); })(d.payload);
if (!att) throw new Error("attachment not found");
const a = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${att.body.attachmentId}`, { headers: H }).then((r) => r.json());
const b = Buffer.from(a.data, "base64url");
const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); const cd = b.readUInt32LE(eocd + 16), n = b.readUInt16LE(eocd + 10);
let p = cd; const entries = [];
for (let i = 0; i < n; i++) { const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32); entries.push({ name: b.toString("utf8", p + 46, p + 46 + nl), m: b.readUInt16LE(p + 10), cs: b.readUInt32LE(p + 20), us: b.readUInt32LE(p + 24), lh: b.readUInt32LE(p + 42) }); p += 46 + nl + el + cl; }
function read(e) { const lnl = b.readUInt16LE(e.lh + 26), lel = b.readUInt16LE(e.lh + 28), s = e.lh + 30 + lnl + lel; const dat = b.subarray(s, s + e.cs); return e.m === 8 ? zlib.inflateRawSync(dat) : dat; }
function dims(buf) { if (buf[0] === 0x89 && buf[1] === 0x50) return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} png`; if (buf[0] === 0xff && buf[1] === 0xd8) { let o = 2; while (o < buf.length) { if (buf[o] !== 0xff) { o++; continue; } const mk = buf[o + 1]; if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return `${buf.readUInt16BE(o + 7)}x${buf.readUInt16BE(o + 5)} jpg`; o += 2 + buf.readUInt16BE(o + 2); } } return "?"; }
console.log(`docx ${(b.length / 1024).toFixed(0)} KB, ${entries.length} entries`);
for (const e of entries.filter((e) => /^word\/media\//.test(e.name))) console.log(`${e.name}  ${(e.us / 1024).toFixed(0)} KB  ${dims(read(e))}`);
