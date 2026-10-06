// One-off, 5 Oct 2026 (Tom's feedback): make a published Barbering article
// skimmable. Plain-English headline, explainer subheads, simpler wording, no
// fact lost. Every link and every number in the original must survive into the
// rewrite or nothing is saved. Writes post_title, post_content and post_excerpt
// directly (no kses pass under WP-CLI), then clears the post cache.
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_simplify-article.mjs <slug> <id> [--dry-run]
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const [slug, idArg] = process.argv.slice(2);
const id = Number(idArg);
const DRY = process.argv.includes("--dry-run");
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
const common = ["-i", cfg.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes"];
const port = String(cfg.port || 18765), target = `${cfg.username}@${cfg.host}`;
const root = cfg.themePath.split("/wp-content/")[0];
const q = (s) => `'${String(s).replace(/'/g, `'\''`)}'`;
const ssh = (cmd) => execFileSync("ssh", [...common, "-p", port, target, `cd ${q(root)} && ${cmd}`], { encoding: "utf8", timeout: 180000, maxBuffer: 64 << 20 });

const title = ssh(`wp post get ${id} --field=post_title`).trim();
const body = ssh(`wp post get ${id} --field=post_content`);

// --cached reuses the reviewed dry-run output; --headline= and --excerpt= override it.
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const cachePath = path.join(os.tmpdir(), `simplify-${slug}-${id}.json`);
const res = process.argv.includes("--cached") ? { content: [{ text: fs.readFileSync(cachePath, "utf8") }] } : await new Anthropic().messages.create({
  model: "claude-sonnet-5",
  max_tokens: 8000,
  system: `${site.houseStyleMd}\n\nYou are re-editing a published ${site.name} article so a barber can skim it on a phone between bookings. Keep every fact, figure, name, date, quote and link exactly. You may:\n- rewrite the headline in the words a barber uses: 60 characters or fewer, no acronyms or official titles they would not say out loud, the money or the change first;\n- add <h2> subheadings so the piece breaks into short explainer sections, along the lines of what is happening, what it means for your shop, and next steps (not those words every time);\n- split long paragraphs, and simplify heavy wording into plain English.\nYou may not add any fact, number, quote or claim, and you may not drop one. Keep every <a href> exactly as written, with its anchor text. Keep quotes character for character. No em or en dashes.\n\nReply ONLY with JSON: {"headline":"","excerpt":"one or two flowing sentences, 120-155 characters, that tease the story","html":"the full article body"}`,
  messages: [{ role: "user", content: `Current headline: ${title}\n\nCurrent body:\n${body}` }],
});
const raw = res.content.map((c) => c.text || "").join("");
const out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
if (arg("headline")) out.headline = arg("headline");
if (arg("excerpt")) out.excerpt = arg("excerpt");

// The guard: links and numbers.
const hrefs = (h) => [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const nums = (h) => [...h.replace(/<[^>]+>/g, " ").matchAll(/\d[\d,.]*/g)].map((m) => m[0].replace(/[.,]$/, ""));
const lostLinks = hrefs(body).filter((u) => !out.html.includes(`href="${u}"`));
const lostNums = [...new Set(nums(body))].filter((n) => !nums(out.html).includes(n));
const dashes = /[—–]/.test(out.html + out.headline + out.excerpt);
console.log(`OLD: ${title}\nNEW: ${out.headline} (${out.headline.length})\nEXCERPT: ${out.excerpt}\nSUBHEADS: ${[...out.html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]).join(" | ")}`);
console.log(`lost links: ${lostLinks.length ? lostLinks.join(", ") : "none"}; lost numbers: ${lostNums.length ? lostNums.join(", ") : "none"}; dashes: ${dashes}`);
const local = path.join(os.tmpdir(), `simplify-${slug}-${id}.json`);
fs.writeFileSync(local, JSON.stringify(out));
if (DRY || lostLinks.length || lostNums.length || dashes) { console.log(DRY ? "dry run, not saved" : "NOT SAVED: guard failed"); process.exit(0); }

execFileSync("scp", [...common, "-P", port, local.split(path.sep).join("/"), `${target}:simplify-${id}.json`], { timeout: 60000 });
const php = `global $wpdb; $o = json_decode(file_get_contents(getenv("HOME")."/simplify-${id}.json"), true); $wpdb->update($wpdb->posts, array("post_title"=>$o["headline"], "post_content"=>$o["html"], "post_excerpt"=>$o["excerpt"]), array("ID"=>${id})); clean_post_cache(${id}); echo "saved";`;
console.log(ssh(`wp eval ${q(php)} && rm -f ~/simplify-${id}.json`));
await prisma.$disconnect();
