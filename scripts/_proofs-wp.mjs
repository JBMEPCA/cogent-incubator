// Put each title's rendered briefing on its own WordPress install: the HTML
// into uploads so it renders exactly as the email will, plus a draft post that
// frames it, so the proof lives on WordPress rather than on my disk.
//
// The whole remote job is piped to `bash -s` on stdin. Embedding a 200KB
// base64 blob and a headline full of apostrophes in an ssh argv broke on both
// length and quoting.
import fs from "node:fs"; import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/proofs";
const idx = JSON.parse(fs.readFileSync(`${SP}/index.json`, "utf8"));
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true, name:true, domain:true }, orderBy: { createdAt: "asc" } });
const STAMP = "2026-10-26";
const links = [];
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
for (const s of sites) {
  const file = `${SP}/${s.slug}.html`;
  if (!fs.existsSync(file)) { console.log(`${s.slug.padEnd(27)} no render`); continue; }
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "sftp" } });
  if (!rows.length) { console.log(`${s.slug.padEnd(27)} no sftp`); continue; }
  const cfg = decryptJson(rows[0].payloadEnc);
  const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
  const wpRoot = cfg.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = ["-i", key, "-p", String(cfg.port||18765), "-o","BatchMode=yes", "-o","StrictHostKeyChecking=accept-new", `${cfg.username}@${cfg.host}`, "bash -s"];
  const meta = idx.find((x) => x.slug === s.slug) || {};
  const rel = `wp-content/uploads/newsletter-proofs/monday-${STAMP}.html`;
  const title = `PROOF Monday briefing ${STAMP}: ${String(meta.subject || "").replace(/"/g, "")}`.slice(0, 160);
  const body = `<!-- wp:html --><p><strong>Subject:</strong> ${String(meta.subject||"")}<br><strong>From:</strong> ${String(meta.fromName||"")}<br><strong>Preview text:</strong> ${String(meta.previewText||"")}</p><iframe src="/${rel}" style="width:100%;max-width:760px;height:2000px;border:1px solid #ddd"></iframe><!-- /wp:html -->`;
  const script = `
set -e
ROOT=$(printf '%s' '${b64(wpRoot)}' | base64 -d)
mkdir -p "$ROOT/wp-content/uploads/newsletter-proofs"
printf '%s' '${fs.readFileSync(file).toString("base64")}' | base64 -d > "$ROOT/${rel}"
printf '%s' '${b64(body)}' | base64 -d > /tmp/pb.html
TITLE=$(printf '%s' '${b64(title)}' | base64 -d)
ID=$(wp post list --path="$ROOT" --post_type=post --post_status=draft --s="PROOF Monday briefing ${STAMP}" --field=ID --format=ids 2>/dev/null | tr ' ' '\n' | head -1)
if [ -n "$ID" ]; then
  wp post update "$ID" /tmp/pb.html --path="$ROOT" --post_title="$TITLE" >/dev/null
else
  ID=$(wp post create /tmp/pb.html --path="$ROOT" --post_type=post --post_status=draft --post_title="$TITLE" --porcelain)
fi
rm -f /tmp/pb.html
echo "ID=$ID"
`;
  try {
    const out = execFileSync("ssh", args, { encoding: "utf8", timeout: 180000, input: script, maxBuffer: 64e6 });
    const id = (out.match(/ID=(\d+)/) || [])[1];
    const direct = `https://${s.domain}/${rel}`;
    console.log(`${s.slug.padEnd(27)} draft ${String(id||"?").padEnd(6)} ${direct}`);
    links.push({ slug: s.slug, name: s.name, subject: meta.subject, previewText: meta.previewText, fromName: meta.fromName, direct, preview: id ? `https://${s.domain}/?p=${id}&preview=true` : null, id, healthWarning: meta.healthWarning, featured: meta.featured, mostRead: meta.mostRead });
  } catch (e) {
    console.log(`${s.slug.padEnd(27)} FAILED ${String(e.stderr||e.message).slice(0,140).replace(/\n/g," ")}`);
  }
}
fs.writeFileSync(`${SP}/links.json`, JSON.stringify(links, null, 1));
await p.$disconnect();
