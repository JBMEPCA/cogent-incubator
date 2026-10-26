import fs from "node:fs"; import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/proofs";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true, domain:true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "sftp" } });
  if (!rows.length) continue;
  const cfg = decryptJson(rows[0].payloadEnc);
  const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
  const wpRoot = cfg.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = ["-i", key, "-p", String(cfg.port||18765), "-o","BatchMode=yes", "-o","StrictHostKeyChecking=accept-new", `${cfg.username}@${cfg.host}`, "bash -s"];
  const script = `
F="${wpRoot}/wp-content/uploads/newsletter-proofs/monday-2026-10-26.html"
echo "bytes=$(wc -c < "$F") imgs=$(grep -o '<img ' "$F" | wc -l) bad=$(grep -c 'undefined\|\[object\|src=""' "$F" || true)"
`;
  try {
    const out = execFileSync("ssh", args, { encoding: "utf8", timeout: 60000, input: script }).trim();
    const m = Object.fromEntries(out.split(/\s+/).map(x=>x.split("=")));
    console.log(`${s.slug.padEnd(27)} ${String(Math.round(m.bytes/1024)+"KB").padStart(6)}  ${String(m.imgs).padStart(2)} images  ${Number(m.bad) ? "BROKEN VALUES" : "clean"}`);
  } catch (e) { console.log(`${s.slug.padEnd(27)} check failed ${String(e.stderr||e.message).slice(0,70)}`); }
}
await p.$disconnect();
