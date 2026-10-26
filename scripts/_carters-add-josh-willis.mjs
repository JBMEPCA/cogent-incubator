/**
 * Carter's Gym (Gym post 134, live since 8 Oct 2026): Hannah sent Josh's
 * surname, Willis, on 8 Oct. Add it everywhere we name him in our own words,
 * and put both owners in the headline now that both names are known. His name
 * inside Hannah's quote ("a video of Josh and I") is left as she wrote it.
 * The slug is NOT changed: the live link has already been emailed to her.
 */
import os from "node:os"; import { execFileSync } from "node:child_process";
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id); const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (a, input) => execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, a], { encoding: "utf8", timeout: 180000, input, maxBuffer: 1 << 26 }).trim();
const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;

const TITLE_TEXT = "Hannah Carter and Josh Willis on making weights feel welcoming";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = "Hannah Carter and Josh Willis on making weights welcoming";
const META = "Carter's Gym owners Hannah Carter and Josh Willis on opening a weights gym in North Walsham, women's only sessions and 70 hour weeks.";
const EXCERPT = "Hannah Carter and Josh Willis opened a weights gym in North Walsham, signed 85 members within weeks and are award finalists in their first year. They explain how they built it around what puts people off strength training, and what 70 hour weeks cost away from the gym.";

let body = wp("post get 134 --field=post_content");
for (const [a, b] of [
  ["run by joint owners Hannah Carter and Josh.", "run by joint owners Hannah Carter and Josh Willis."],
  ["<p>Hannah Carter and Josh opened", "<p>Hannah Carter and Josh Willis opened"],
]) { if (!body.includes(a)) throw new Error(`not found: ${a}`); body = body.replace(a, b); }
if (!body.includes("a video of Josh and I")) throw new Error("quote changed unexpectedly");

const stamp = Date.now();
ssh(`base64 -d > /tmp/carter-${stamp}.html`, Buffer.from(body, "utf8").toString("base64"));
wp(`post update 134 /tmp/carter-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)}`);
ssh(`rm -f /tmp/carter-${stamp}.html`);
wp(`post meta update 134 _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update 134 _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post update 139 --post_excerpt=${b64("Josh Willis (left) and Hannah Carter. Picture: supplied")}`);
wp(`post meta update 139 _wp_attachment_image_alt ${b64("Josh Willis and Hannah Carter, joint owners of Carter's Gym, on their gym floor in North Walsham")}`);
ssh(`cd '${docroot}' && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);

const db = forSite(site.id);
const art = await db.article.findFirst({ where: { wpPostId: 134 } });
if (art) await db.article.update({ where: { id: art.id }, data: { title: `Gym Champions: ${TITLE_TEXT}`, body, metaDesc: META } });
await db.interviewTarget.update({ where: { id: "cmukzyx1r002f92os4dxnj1hp" }, data: { personRole: "Joint owner, Carter's Gym, with Josh Willis" } });

const url = wp("post url 134");
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' '${url}?nc=${stamp}'`);
const front = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://gymbusinessnews.com/?nc=${stamp}'`);
console.log({ url, status: wp("post get 134 --field=post_status"), willisOnPage: (page.match(/Josh Willis/g) || []).length, titleTag: (page.match(/<title>[^<]*/) || [])[0], homeShowsWillis: front.includes("Josh Willis"), leak: /&lt;span class=(&quot;|")franchise-eyebrow|%3Cspan%20class%3D/.test(page + front) });
await prisma.$disconnect();
