/** One-off: can we lint PHP on the Smart SME host before a file goes live? */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
await prisma.$disconnect();

const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const args = ["-i", key, "-p", String(cfg.port || 18765), "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", `${cfg.username}@${cfg.host}`];
const remote = `php -v 2>/dev/null | head -1; echo "wp: $(command -v wp || echo none)"; echo "theme: ${cfg.themePath}"; ls -la "${cfg.themePath}/functions.php" 2>&1; echo "php -l test:"; printf '<?php echo 1;' > /tmp/_lint_probe.php && php -l /tmp/_lint_probe.php; rm -f /tmp/_lint_probe.php`;
console.log(execFileSync("ssh", [...args, remote], { encoding: "utf8", timeout: 30000 }));
