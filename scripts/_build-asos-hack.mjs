/**
 * Smart SME: the ASOS "hacked" push notification (6 Oct 2026). Own news piece,
 * JB asked for it directly, so it publishes to the homepage (no bury tag).
 * Facts from STV/PA, ITV, Retail Gazette, LADbible; ASOS statement via PA.
 * Run: node --import ./scripts/_register.mjs --env-file=.env scripts/_build-asos-hack.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const CATEGORY_NAME = "News";
const TITLE = "ASOS hacked alert: what small businesses should check now";
const META = "ASOS app users got an ASOS HACKED alert claiming its Snowflake data was stolen. What happened, and five checks every small business should make this week.";
const EXCERPT = "Thousands of ASOS app users were sent a push notification reading ASOS HACKED, claiming the retailer's Snowflake data had been stolen. Shares fell around 11%. Here is what is known, and what a small business should check this week.";
const KEYPHRASE = "ASOS hacked";
if (/[—–]/.test(TITLE + META + EXCERPT)) throw new Error("em or en dash");
if (META.length > 155) throw new Error(`meta is ${META.length} chars`);
if (TITLE.length > 60) throw new Error(`title ${TITLE.length} chars`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;
const q = (s) => `&#8220;${s}&#8221;`;
const BODY = [
  P(`Thousands of ASOS customers picked up their phones on Tuesday morning to find a push notification from the retailer&#8217;s own app with the title ${q("ASOS HACKED")}. The message was not meant for them. It was addressed to the company&#8217;s data protection officer and IT team.`),
  P(`It read: ${q("Dear ASOS DPO and IT, we have fully compromised the Snowflake instance. Engage with us, or we will leak it.")} The notification carried a link that appeared to lead to the attackers&#8217; Telegram channel.`),
  P(`ASOS said: ${q("We&#8217;re aware of the notification and are currently investigating. We don&#8217;t have any further information to share at this stage, but we&#8217;ll provide an update as soon as we know more.")}`),
  P(`Its shares fell by around 11% in morning trading on the London Stock Exchange, wiping roughly &#163;70 million off the company&#8217;s value. The website and app were working normally, and at the time of writing it has not been confirmed that any customer personal or payment data was taken, or how the attackers were able to send a message through the app.`),
  H(`What is Snowflake, and why it matters`),
  P(`Snowflake is a US cloud platform that companies use to store and analyse large amounts of data, often including customer and order records. In 2024 hundreds of Snowflake customers were targeted in a mass data theft and extortion campaign. Investigators found that the attackers had not broken Snowflake itself; they had logged into customer accounts with stolen usernames and passwords, on accounts that did not have multi-factor authentication switched on.`),
  P(`Whether that is what happened at ASOS is not yet known. But the pattern is the lesson: the weak point is rarely the big platform, it is the login to it.`),
  H(`An unusually public threat`),
  P(`Most extortion attempts happen quietly by email. Using the company&#8217;s own app to message its customers turns the threat into a public event and piles pressure on the business to respond.`),
  P(`Marijus Briedis, chief technology officer at NordVPN, said: ${q("This is an unusually brazen and threatening message. The attackers aren&#8217;t simply claiming to have breached Asos; they&#8217;re publicly telling the company to engage with them or they will leak what they say they have obtained.")}`),
  P(`He added that the bigger risk for customers comes next: ${q("High-profile cyber incidents create ideal conditions for phishing attacks.")} Expect emails and texts this week pretending to be ASOS, offering refunds, account checks or compensation.`),
  P(`It follows the cyber attacks on Marks &amp; Spencer and the Co-op in spring 2025, which showed how quickly a security incident becomes a trading problem for a well-known retailer.`),
  H(`Why this matters if you run a small business`),
  P(`ASOS has a security team. Most small firms do not, yet they rely on the same kind of tools: a cloud database or CRM holding customer records, an email marketing platform, an SMS or app notification service, and an online shop. Any one of those, in the wrong hands, can be used to talk to every customer you have at once.`),
  `<div class="takeaways"><p><em>Five checks to make this week.</em></p><ul>
    <li><strong>Turn on multi-factor authentication everywhere customer data lives.</strong> Your CRM, email marketing tool, e-commerce platform, cloud storage and accounting software. This is the one control that would have stopped most of the 2024 Snowflake thefts.</li>
    <li><strong>Find out who can message your customers.</strong> List every tool that can send to your whole list (email, SMS, WhatsApp, app push) and every login that can press send. Remove former staff, agencies you no longer use, and shared logins.</li>
    <li><strong>Check old API keys and integrations.</strong> Apps and plug-ins you connected years ago often still have access. Revoke anything you do not recognise or no longer use.</li>
    <li><strong>Know the 72-hour rule.</strong> Under UK GDPR you must report a personal data breach that poses a risk to people to the <a href="https://ico.org.uk/for-organisations/report-a-breach/">Information Commissioner&#8217;s Office</a> within 72 hours of becoming aware of it. Decide now who makes that call.</li>
    <li><strong>Warn your customers before the scammers reach them.</strong> If you are ever hit, tell customers plainly what you will and will not ask them for. Phishing follows every public incident.</li>
  </ul></div>`,
  P(`If you have not yet done the basics, the government-backed Cyber Essentials scheme is the cheapest place to start. Our guide to <a href="https://smartsme.co.uk/cyber-essentials-explained-what-uk-small-businesses-need-to-know/">Cyber Essentials for UK small businesses</a> explains what it covers and what it costs.`),
  P(`We will update this story when ASOS says more.`),
].join("\n\n");

if (DRY) { console.log(`DRY: "${TITLE}" (${TITLE.length}) meta ${META.length}`); process.exit(0); }

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { chooseSmartImage } = await import("../lib/images.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const picked = await chooseSmartImage(site, { title: TITLE, keyphrase: KEYPHRASE, category: CATEGORY_NAME });
await prisma.$disconnect();
if (!picked.image) { console.log("NO IMAGE:", picked.reason, picked.tried); process.exit(1); }
const img = picked.image;
console.log("image", img.url, "|", img.alt, "|", img.credit);
const raw = Buffer.from(await fetch(img.url, { headers: { "user-agent": "Mozilla/5.0 (CogentBot)" } }).then((r) => r.arrayBuffer()));
const hero = await sharp(raw).resize(1600, 900, { fit: "cover", position: "attention" }).jpeg({ quality: 85 }).toBuffer();

const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const dup = JSON.parse(wp(`post list --post_type=post --post_status=any --s=ASOS --fields=ID,post_title --format=json`));
if (dup.length) throw new Error(`possible duplicate: ${dup.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);
const categoryId = wp(`term list category --name=${sq(CATEGORY_NAME)} --field=term_id`).split(/\s+/)[0];
const credit = img.credit ? P(`<em style="font-size:0.85em">Image: ${img.credit.replace(/^(Image|Photo):\s*/i, "")}</em>`) : "";
const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`asos-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/asos-hero-${stamp}.jpg --title=${sq(img.alt)} --alt=${sq(img.alt)} --porcelain`);
put(`asos-body-${stamp}.html`, Buffer.from(BODY + (credit ? "\n\n" + credit : ""), "utf8"));
const postId = wp(`post create /tmp/asos-body-${stamp}.html --post_type=post --post_status=publish --post_category=${categoryId} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/asos-hero-${stamp}.jpg /tmp/asos-body-${stamp}.html; cd ${sq(docroot)} && wp cache flush >/dev/null; wp sg purge >/dev/null 2>&1; true`);
console.log(`PUBLISHED ${postId} ${wp(`post url ${postId}`)}`);
