/**
 * Smart SME: Allica Bank's Gareth Anderson on the Bank of England holding
 * Bank Rate at 3.75% (17 Sep 2026). Pitched by Hannah McDonald, Rosely Group,
 * forwarded by Lucas to press@smartsme.co.uk (thread 1a0af0c711500df3).
 * DRAFT over SSH. Finance category, buried tag (pitched PR).
 *
 * No photo was supplied, so the hero is a name card (person stories need a
 * person photo or a name card plus a headshot ask; the reply asks Hannah).
 * Pass --hero=<url> to use a real headshot instead.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-allica.mjs [--dry] [--hero=URL]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const HERO_URL = (process.argv.find((a) => a.startsWith("--hero=")) || "").split("=").slice(1).join("=");
const CATEGORY_NAME = "Finance";
const TAG = "guest-perspective";

const TITLE = "Bank Rate held at 3.75%: what it means for small businesses";
const META = "The Bank of England holds Bank Rate at 3.75% until at least 5 November. Allica Bank's Gareth Anderson on borrowing, energy costs and the Budget for SMEs.";
const EXCERPT = "The Bank of England has held Bank Rate at 3.75%, so borrowing costs stay put until at least 5 November. Allica Bank's Gareth Anderson on what that means for firms heading into Q4 with energy prices rising and the Budget still to come.";
const KEYPHRASE = "Bank Rate small businesses";
if (/[—–]/.test(TITLE + META + EXCERPT)) throw new Error("em or en dash");
if (META.length > 155) throw new Error(`meta is ${META.length} chars`);
if (TITLE.length > 60) console.warn(`title ${TITLE.length} chars`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;
const BODY = [
  P(`The Bank of England has held Bank Rate at 3.75%, leaving borrowing costs where they are for small businesses heading into the final quarter of the year. The Monetary Policy Committee announced the decision on 17 September. Its next decision is due on 5 November, after the Autumn Budget.`),
  P(`The hold was widely expected. The Bank has kept the rate at 3.75% since the spring, and at its July meeting three of the nine committee members voted to raise it to 4% over concerns that higher energy prices could keep inflation elevated for longer. Nobody on the committee has been voting for a cut.`),
  P(`For a small business, the practical effect is that the cost of an existing variable-rate loan or overdraft does not move, and the cost of a new asset finance or working capital facility is unlikely to move before November. That stability arrives at a difficult moment, with energy prices rising again and the Budget still to come.`),
  H(`Relief, but pressure on energy and dollar-priced inputs`),
  P(`Gareth Anderson is Head of Business Management at Allica Bank, which lends to established small and medium-sized firms. Speaking about manufacturers, the sector most exposed to energy and imported commodity prices, he said the decision would be welcome but other costs would keep rising.`),
  P(`&#8220;Manufacturers will be breathing a sigh of relief following the Bank of England&#8217;s decision to hold the base rate where it is, and thus keep borrowing costs steady,&#8221; he said. &#8220;With the conflict in Iran having now spread and started to impact Saudi Arabia, rising energy prices are likely to put further pressure on the sector in Q4 and the Fed&#8217;s decision yesterday to hike its own rate could further compound this issue for British manufacturers purchasing energy and other dollar priced commodities.&#8221;`),
  P(`A stronger dollar raises the sterling cost of oil, gas, metals and anything else priced in dollars, which feeds through to any business that buys energy on a variable tariff or imports stock.`),
  H(`Caution ahead of the Budget, but investment still on the table`),
  P(`Anderson expects businesses to stay cautious through the autumn, but argued that steady borrowing costs give firms a window to keep investing in efficiency and new technology rather than waiting.`),
  P(`&#8220;As we head into Q4 then - and with many established manufacturing businesses also nervously awaiting the outcome of the Autumn budget - we&#8217;re likely to see continued caution in the sector,&#8221; he said. &#8220;That said, the global pace of innovation in tech, energy supply and AI shows no signs of slowing down. Steady borrowing costs therefore do present an opportunity for manufacturers to continue investing in the efficiencies and innovations that the future of British manufacturing demands.&#8221;`),
  H(`The lending gap for established firms`),
  P(`Anderson used the decision to point at what he sees as a long-standing gap in the market for businesses with between five and 250 employees.`),
  P(`&#8220;The opportunity for the financial sector is to continue to support manufacturing businesses - especially established manufacturing businesses with between 5 and 250 employees - as they look to invest in this innovation,&#8221; he said. &#8220;These businesses are the foundation of the industry in the UK but have historically been overlooked by high-street banks, leaving the UK with a sizable business lending gap. If ever there was a time to close this gap, now is it.&#8221;`),
  H(`What this means for your business`),
  `<div class="takeaways"><p><em>Editor's notes.</em></p><ul>
    <li><strong>Variable-rate borrowing costs the same until at least 5 November.</strong> If you have been holding off an asset purchase waiting for a cut, the committee's recent votes point the other way. Three members wanted a rise in July; none wanted a cut.</li>
    <li><strong>Fixed-rate offers are worth a look now.</strong> Lenders price fixed deals off where they expect rates to go. With the risk tilted towards a rise, a fixed rate on a term loan or asset finance is insurance against the next two decisions going the wrong way.</li>
    <li><strong>Energy is the cost to watch, not interest.</strong> If your energy contract is on a variable or short-term deal, get a renewal quote now rather than in November. A stronger dollar makes gas dearer in sterling before it reaches your bill.</li>
    <li><strong>Budget for the Budget.</strong> The next rate decision lands after the Autumn Budget. Anything that depends on business rates, capital allowances or employer NICs should be modelled on both outcomes, not one.</li>
  </ul></div>`,
  P(`The Monetary Policy Committee&#8217;s next decision is due on 5 November.`),
].join("\n\n");

// ---- hero: real headshot if given, else a name card ----
let hero, heroAlt;
if (HERO_URL) {
  const raw = Buffer.from(await fetch(HERO_URL, { headers: { "user-agent": "Mozilla/5.0 (CogentBot)" } }).then((r) => r.arrayBuffer()));
  const m = await sharp(raw).metadata();
  const th = Math.round((m.width * 9) / 16);
  const extra = Math.max(0, th - m.height);
  hero = await sharp(raw).resize(m.width, Math.max(m.height, th), { fit: "cover" }).blur(28).composite([{ input: raw, top: Math.floor(extra / 2), left: 0 }]).jpeg({ quality: 88 }).toBuffer();
  heroAlt = "Gareth Anderson, Head of Business Management at Allica Bank";
} else {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
    <rect width="1200" height="675" fill="#f4f1ea"/>
    <rect x="0" y="0" width="14" height="675" fill="#1f3a5f"/>
    <text x="90" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#5a5a5a">Bank of England holds Bank Rate at 3.75%</text>
    <text x="90" y="345" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="bold" fill="#1a1a1a">Gareth Anderson</text>
    <text x="90" y="405" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#333">Head of Business Management, Allica Bank</text>
    <text x="90" y="590" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#777">Smart SME</text>
  </svg>`;
  hero = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  heroAlt = "Name card: Gareth Anderson, Head of Business Management, Allica Bank, on the Bank of England holding Bank Rate at 3.75%";
}
console.log(`hero ${HERO_URL ? "from url" : "name card"}, ${(hero.length / 1024).toFixed(0)} KB`);
if (DRY) { console.log(`DRY: "${TITLE}" (${TITLE.length}) meta ${META.length}`); process.exit(0); }

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

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`)).filter((r) => /bank rate|allica/i.test(r.post_title));
if (existing.length) throw new Error(`possible duplicate: ${existing.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);
const categoryId = wp(`term list category --name=${sq(CATEGORY_NAME)} --field=term_id`).split(/\s+/)[0];
if (!/^\d+$/.test(categoryId)) throw new Error(`category "${CATEGORY_NAME}" not found: ${categoryId}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`allica-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/allica-hero-${stamp}.jpg --title=${sq("Gareth Anderson, Allica Bank")} --alt=${sq(heroAlt)} --porcelain`);
put(`allica-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
const postId = wp(`post create /tmp/allica-body-${stamp}.html --post_type=post --post_status=draft --post_category=${categoryId} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post term set ${postId} post_tag ${TAG}`);
ssh(`rm -f /tmp/allica-hero-${stamp}.jpg /tmp/allica-body-${stamp}.html`);
console.log(`DRAFT ${postId}: "${TITLE}"  hero ${heroId}  tags: ${wp(`post term list ${postId} post_tag --field=slug`)}  cat: ${wp(`post term list ${postId} category --field=name`)}`);
