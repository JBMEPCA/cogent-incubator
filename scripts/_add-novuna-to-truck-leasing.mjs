/**
 * Add Novuna to Fleet post 287, "Best Truck Leasing Companies for UK HGV
 * Operators in 2026". JB, 23 Oct 2026: "sort and make sure he backlinks",
 * after a link request from Kev Gall at Nomada Digital, who works for Novuna.
 *
 * What was checked before agreeing, because the pitch and the page did not
 * match. Kev pitched Novuna BUSINESS FINANCE, which on its own transport
 * finance page offers hire purchase and leasing of assets you end up owning,
 * and explicitly does not do business loans. That is asset finance, not truck
 * leasing, so it does not belong in a contract hire comparison.
 *
 * Novuna VEHICLE SOLUTIONS, a different trading style of the same legal
 * entity, does lease HGVs: its truck and specialist leasing page offers
 * maintenance, compliance support and in-life fleet management, with the asset
 * returned or replaced at the end of the term. That belongs in the table.
 *
 * So both go in, each in the right place, and neither is described in words
 * the company does not use: "contract hire" and "operating lease" appear
 * nowhere on their pages, so the copy says full-service leasing instead.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_add-novuna-to-truck-leasing.mjs [--write]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const WRITE = process.argv.includes("--write");
const POST_ID = 287;
const VS = "https://www.novunavehiclesolutions.co.uk/business-vehicle-leasing/truck-and-specialist-leasing/";
const BF = "https://www.novuna.co.uk/business-finance/asset-finance/transport-finance/";

const ROW = `<tr>
<td>Novuna Vehicle Solutions</td>
<td>Independent, multi-brand</td>
<td>Yes</td>
<td>HGV, plant and specialist fleets wanting maintenance and compliance managed inside the lease</td>
</tr>`;

const PARA = `<p>Novuna Vehicle Solutions sits in the same independent camp, and its <a href="${VS}">truck and specialist leasing</a> covers HGVs, plant, forklifts and purpose-built vehicles alongside cars and vans. Maintenance, defect and vehicle-off-road management, compliance support from CPC-qualified staff and in-life fleet management can sit inside the agreement, and the asset is returned or replaced at the end of the term. It is a trading style of Mitsubishi HC Capital UK PLC, authorised and regulated by the Financial Conduct Authority under register number 704348. It publishes no terms or prices, so the mileage, hours-of-use and return-condition detail only arrives with a quote, and trailers are not among the assets it lists.</p>`;

const SECTION = `<h2>Funding a truck you intend to own</h2>
<p>Leasing is not the only route. If you want the vehicle on your own balance sheet at the end of the term, that is hire purchase or a finance lease, and the providers are asset finance houses rather than leasing companies. <a href="${BF}">Novuna Business Finance</a>, the same legal entity under a different trading style, funds HGVs, vans and specialist commercial vehicles, and also trailers, tankers and refrigerated units, which its leasing arm does not list. It states that applicants must have traded for at least three years and be a UK limited company, PLC, LLP or partnership of four or more, and that it does not offer business loans, so the money is tied to the asset.</p>
<p>The trade-off is the usual one. Own the truck and you keep whatever it is worth in five years, along with the risk that it is worth less than you assumed. Lease it and that risk sits with the leasing company, priced into the rental.</p>`;

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const sshArgs = ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`];
const ssh = (cmd, input) => execFileSync("ssh", [...sshArgs, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

let body = execFileSync("ssh", [...sshArgs, `cd ${sq(docroot)} && wp post get ${POST_ID} --field=post_content`], { encoding: "utf8", maxBuffer: 32e6 });
const before = body.length;
if (/Novuna/i.test(body)) { console.error("Novuna is already in the article. Nothing to do."); process.exit(1); }

// 1. table row, after the Reflex Vehicle Hire row (the last one)
const reflexEnd = body.indexOf("</tr>", body.indexOf("Reflex Vehicle Hire</td>"));
if (reflexEnd < 0) throw new Error("could not find the Reflex row");
body = body.slice(0, reflexEnd + 5) + "\n" + ROW + body.slice(reflexEnd + 5);

// 2. paragraph at the end of the independents section, before the comparison heading
const cmpHeading = body.indexOf("<h2>Comparison:");
if (cmpHeading < 0) throw new Error("could not find the comparison heading");
body = body.slice(0, cmpHeading) + PARA + "\n" + body.slice(cmpHeading);

// 3. the ownership section, before "What a leasing quote actually includes"
const quoteHeading = body.indexOf("<h2>What &#8220;a leasing quote");
const target = quoteHeading >= 0 ? quoteHeading : body.indexOf("<h2>What a leasing quote actually includes</h2>");
if (target < 0) throw new Error("could not find the quote heading");
body = body.slice(0, target) + SECTION + "\n" + body.slice(target);

if (/[—–]/.test(ROW + PARA + SECTION)) throw new Error("dash in the new copy");
console.log(`body ${before} -> ${body.length} chars (+${body.length - before})`);
if (!WRITE) {
  console.log("\n--- new table row ---\n" + ROW + "\n\n--- new paragraph ---\n" + PARA + "\n\n--- new section ---\n" + SECTION);
  console.log("\nDRY RUN, nothing written.");
  await prisma.$disconnect();
  process.exit(0);
}

const tmp = `/tmp/novuna-287-${Date.now()}.html`;
ssh(`base64 -d > ${tmp}`, Buffer.from(body, "utf8").toString("base64"));
wp(`post update ${POST_ID} ${tmp}`);
ssh(`rm -f ${tmp}`);
const check = execFileSync("ssh", [...sshArgs, `cd ${sq(docroot)} && wp post get ${POST_ID} --field=post_content`], { encoding: "utf8", maxBuffer: 32e6 });
console.log(`live body now ${check.length} chars, Novuna mentions: ${(check.match(/Novuna/g) || []).length}`);

const art = await prisma.article.findFirst({ where: { siteId: site.id, wpPostId: POST_ID } });
if (art) {
  await prisma.article.update({ where: { id: art.id }, data: { body: check } });
  console.log(`article row ${art.id} updated`);
} else {
  console.log("no Article row for this post, WordPress only");
}
console.log(wp(`post url ${POST_ID}`));
await prisma.$disconnect();
