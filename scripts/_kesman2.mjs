import os from "node:os"; import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "sftp" } }))[0].payloadEnc);
const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const root = cfg.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const args = ["-i", key, "-p", String(cfg.port||18765), "-o","BatchMode=yes","-o","StrictHostKeyChecking=accept-new", `${cfg.username}@${cfg.host}`, "bash -s"];
console.log(execFileSync("ssh", args, { encoding: "utf8", timeout: 60000, input: `
echo "=== 1078 ==="
wp post get 1078 --path="${root}" --fields=ID,post_title,post_status,post_date,post_modified,post_name 2>&1
echo "=== first 900 chars of 1078 body ==="
wp post get 1078 --path="${root}" --field=post_content 2>&1 | head -c 900
` }));
await p.$disconnect();
