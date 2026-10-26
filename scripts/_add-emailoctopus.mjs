/**
 * Add EmailOctopus to Smart SME post 241, "Best email marketing platforms for
 * UK small businesses in 2026", at the request of co-founder Gareth Bull
 * (12 Oct 2026, thread 1a12faac2571af10). Over SSH + wp-cli.
 *
 * Facts checked on emailoctopus.com on 12 Oct 2026: free plan 2,500
 * subscribers and 10,000 emails a month with EmailOctopus branding; Pro from
 * $9 a month billed yearly; no trial, the free plan is the trial; 20%
 * lifetime discount for nonprofits; EmailOctopus Connect for sending through
 * your own Amazon SES. Three Hearts Digital Ltd, registered in England and
 * Wales, Shoreditch. "Bootstrapped" is Gareth's own description.
 *
 * Three insertions, each anchored on text that must exist exactly once:
 *   1. an <h3> section after MailerLite's
 *   2. a comparison-table row after MailerLite's
 *   3. a mention in the "Shortlist two platforms" step
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_add-emailoctopus.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry");
const POST_ID = 241;

const SECTION = `<h3>EmailOctopus</h3>
<p><a href="https://emailoctopus.com" target="_blank" rel="noopener">EmailOctopus</a> is the UK entry on this list, run from Shoreditch and bootstrapped rather than investor-funded, which its founders credit for keeping prices low. The free plan is one of the most generous here: up to 2,500 subscribers and 10,000 emails a month, with EmailOctopus branding on your sends and a single user. Pro starts at around $9 a month billed yearly, removes the branding, keeps reports indefinitely and allows unlimited users, which few rivals offer at that price. There is no time-limited trial; the free plan is the trial. Nonprofits get 20 per cent off for life. The editor and automation are simpler than Mailchimp's, so it suits a business that wants a reliable newsletter and a welcome sequence rather than deep ecommerce flows. If you already send through Amazon SES, its Connect product is cheaper still.</p>`;

const ROW = `<tr>
<td>EmailOctopus</td>
<td>Price-conscious firms with lists under 2,500</td>
<td>Yes, 2,500 subscribers</td>
<td>Subscribers</td>
<td>Low cost, unlimited users on Pro, UK company</td>
</tr>`;

// Anchors.
const AFTER_MAILERLITE_SECTION = `it is an easy recommendation.</p>`;
const AFTER_MAILERLITE_ROW = `<td>Low cost, clean editor</td>
</tr>`;
const SHORTLIST_OLD = `value tools like MailerLite or Brevo for service firms`;
const SHORTLIST_NEW = `value tools like MailerLite, EmailOctopus or Brevo for service firms`;

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
await prisma.$disconnect();
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const content = wp(`post get ${POST_ID} --field=post_content`);
if (/EmailOctopus/i.test(content)) throw new Error("EmailOctopus is already in the post; refusing to add it twice");
const once = (needle) => { const n = content.split(needle).length - 1; if (n !== 1) throw new Error(`anchor found ${n} times, expected 1: ${needle.slice(0, 50)}`); };
once(AFTER_MAILERLITE_SECTION); once(AFTER_MAILERLITE_ROW); once(SHORTLIST_OLD);

const updated = content
  .replace(AFTER_MAILERLITE_SECTION, AFTER_MAILERLITE_SECTION + "\n" + SECTION)
  .replace(AFTER_MAILERLITE_ROW, AFTER_MAILERLITE_ROW + "\n" + ROW)
  .replace(SHORTLIST_OLD, SHORTLIST_NEW);
console.log(`content ${content.length} -> ${updated.length} chars`);
if (DRY) { console.log(SECTION); process.exit(0); }

const stamp = Date.now();
ssh(`base64 -d > /tmp/eo-${stamp}.html`, Buffer.from(updated, "utf8").toString("base64"));
wp(`post update ${POST_ID} /tmp/eo-${stamp}.html`);
ssh(`rm -f /tmp/eo-${stamp}.html && cd ${sq(docroot)} && wp cache flush && (wp sg purge >/dev/null 2>&1 || true)`);

const url = wp(`post url ${POST_ID}`);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(url)}`);
const fresh = wp(`post get ${POST_ID} --field=post_content`);
console.log(JSON.stringify({
  url,
  storedMentions: (fresh.match(/EmailOctopus/g) || []).length,
  sectionStored: fresh.includes("<h3>EmailOctopus</h3>"),
  rowStored: fresh.includes("<td>EmailOctopus</td>"),
  renderedMentions: (page.match(/EmailOctopus/g) || []).length,
  captcha: /SG-Captcha|Robot Challenge/i.test(page),
  modified: wp(`post get ${POST_ID} --field=post_modified_gmt`),
}, null, 2));
