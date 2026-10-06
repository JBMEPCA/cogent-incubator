// Shared SSH handle for the Nursery Daily one-offs. Mirrors _barber-ssh.mjs.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

export const prisma = new PrismaClient();

export async function nurserySsh() {
  const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
  const target = `${s.username}@${s.host}`;
  const args = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
  // ssh() takes a command and NOTHING else. On 1 Oct 2026 a one-off called it
  // as ssh("base64 -d > /tmp/x.html", payload), copying the shape of the BDP
  // script whose own ssh() does accept stdin. The argument was ignored, the
  // file was written empty, and `wp post update` then blanked the body of a
  // live published article. Fail loudly instead of silently: to send bytes,
  // use put(buffer, remotePath).
  const ssh = (cmd, ...rest) => {
    if (rest.length) throw new Error("ssh() takes no stdin; use put(buffer, remotePath) to send bytes");
    return execFileSync("ssh", [...args, target, `cd '${docroot}' && ${cmd}`], {
      encoding: "utf8",
      timeout: 300000,
      maxBuffer: 64e6,
    }).trim();
  };
  const put = (buf, remote) =>
    execFileSync("ssh", [...args, target, `base64 -d > '${remote}'`], {
      input: buf.toString("base64"),
      timeout: 300000,
      maxBuffer: 128e6,
    });
  return { site, ssh, put, docroot };
}

export const b64 = (x) => Buffer.from(x, "utf8").toString("base64");
