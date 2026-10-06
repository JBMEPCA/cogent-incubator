// Shared SSH handle for the Barbering Business one-offs.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

export const prisma = new PrismaClient();

export async function barberSsh() {
  const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
  const target = `${s.username}@${s.host}`;
  const args = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
  const ssh = (cmd) =>
    execFileSync("ssh", [...args, target, `cd '${docroot}' && ${cmd}`], {
      encoding: "utf8",
      timeout: 300000,
      maxBuffer: 64e6,
    }).trim();
  const put = (buf, remote) =>
    execFileSync("ssh", [...args, target, `base64 -d > '${remote}'`], {
      input: buf.toString("base64"),
      timeout: 300000,
      maxBuffer: 128e6,
    });
  return { site, ssh, put, docroot };
}

export const b64 = (x) => Buffer.from(x, "utf8").toString("base64");
