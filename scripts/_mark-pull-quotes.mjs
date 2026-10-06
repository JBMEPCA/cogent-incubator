// One-off, 5 Oct 2026: on interviews published before the Q&A format, keep two
// or three bubbles. The theme now draws a bubble only for .interview-quote--pull,
// so without this every existing interview would lose them all. Haiku picks the
// most striking quotes; only the class attribute changes, never the words.
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_mark-pull-quotes.mjs <slug>:<id>,<id> ... [--dry-run]
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const DRY = process.argv.includes("--dry-run");
const jobs = process.argv.slice(2).filter((a) => a.includes(":"));
const prisma = new PrismaClient();
const anthropic = new Anthropic();
const q = (s) => `'${String(s).replace(/'/g, `'\''`)}'`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pull-"));

for (const job of jobs) {
  const [slug, idList] = job.split(":");
  const site = await prisma.site.findUnique({ where: { slug } });
  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
  const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
  const port = String(cfg.port || 18765);
  const target = `${cfg.username}@${cfg.host}`;
  const root = cfg.themePath.split("/wp-content/")[0];
  const common = ["-i", key, "-o", "BatchMode=yes"];
  const ssh = (cmd) => execFileSync("ssh", [...common, "-p", port, target, `cd ${q(root)} && ${cmd}`], { encoding: "utf8", timeout: 180000, maxBuffer: 64 << 20 });

  for (const id of idList.split(",").map(Number)) {
    const content = ssh(`wp post get ${id} --field=post_content`).replace(/\n$/, "");
    const re = /<blockquote class="wp-block-quote interview-quote">([\s\S]*?)<\/blockquote>/g;
    const quotes = [...content.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (/interview-quote--pull/.test(content) || quotes.length === 0) { console.log(`${slug} ${id}: nothing to do`); continue; }
    const want = quotes.length >= 9 ? 3 : Math.min(2, quotes.length);
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      system: `You pick pull quotes for an interview. Choose the ${want} most striking, quotable lines: a surprising view, a memorable phrase, a hard-won lesson. Prefer short ones, and spread them through the piece rather than taking neighbours. Reply ONLY with a JSON array of ${want} zero-based indices.`,
      messages: [{ role: "user", content: quotes.map((t, i) => `${i}. ${t}`).join("\n") }],
    });
    const picks = [...new Set((JSON.parse(res.content[0].text.match(/\[[^\]]*\]/)[0]) || []).map(Number))].filter((i) => i >= 0 && i < quotes.length).slice(0, want);
    let n = -1;
    const updated = content.replace(re, (whole) => (picks.includes(++n) ? whole.replace('class="wp-block-quote interview-quote"', 'class="wp-block-quote interview-quote interview-quote--pull"') : whole));
    console.log(`${slug} ${id}: ${quotes.length} quotes, pulling ${picks.join(",")}: ${picks.map((i) => `"${quotes[i].slice(0, 60)}"`).join(" | ")}`);
    if (DRY) continue;
    const local = path.join(tmpDir, `${slug}-${id}.html`);
    fs.writeFileSync(local, updated);
    const remote = `pull-${slug}-${id}.html`;
    execFileSync("scp", [...common, "-P", port, local.split(path.sep).join("/"), `${target}:${remote}`], { timeout: 60000 });
    ssh(`wp post update ${id} ~/${remote} && rm -f ~/${remote}`);
  }
}
await prisma.$disconnect();
