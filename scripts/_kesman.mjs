import os from "node:os"; import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "sftp" } }))[0].payloadEnc);
const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const root = cfg.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const args = ["-i", key, "-p", String(cfg.port||18765), "-o","BatchMode=yes","-o","StrictHostKeyChecking=accept-new", `${cfg.username}@${cfg.host}`, "bash -s"];
const out = execFileSync("ssh", args, { encoding: "utf8", timeout: 60000, input: `
wp post get 1080 --path="${root}" --fields=ID,post_title,post_status,post_date 2>&1 | head -8
echo "--- any other Kesman posts ---"
wp post list --path="${root}" --post_type=post --post_status=any --s=Kesman --fields=ID,post_title,post_status 2>&1 | head -10
` });
console.log(out);
await p.$disconnect();
