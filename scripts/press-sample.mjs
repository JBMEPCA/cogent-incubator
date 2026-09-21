// Dry-run the press desk on a real published release, as if it had been emailed
// in. Nothing is sent or published. Prints the draft and the source side by side.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/press-sample.mjs <slug> <release url>
//   PRESS_DEBUG=1 ... also prints why a draft was held
import { dryRunMessage } from "../lib/press-intake.js";
import { prisma, forSite } from "../lib/prisma.js";
const [slug, url] = process.argv.slice(2);
const html = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text();
const main = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1];
const strip = (h) => h.replace(/<(script|style|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|h\d|li|div)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z#0-9]+;/gi, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
const text = strip(main);
const title = html.match(/<title>([^<]+)/i)?.[1]?.split("|")[0].trim();
console.log(`source: ${text.split(/\s+/).length} words, image ${og || "none"}`);
const r = await dryRunMessage(slug, {
  from: "Press Office <pressoffice@example.com>",
  subject: `PRESS RELEASE: ${title}`,
  date: new Date(),
  text,
  html: og ? `<p>release</p><img src="${og}">` : "",
});
console.log(JSON.stringify(r));
if (r.article) {
  const s = await prisma.site.findUnique({ where: { slug }, select: { id: true } });
  const a = await forSite(s.id).article.findUnique({ where: { id: r.article } });
  console.log(`TITLE (${a.title.length}): ${a.title}\nCATEGORY: ${a.category}  QA: ${a.qaPassed}\nMETA: ${a.metaDesc}\nALT: ${a.imageAlt} | CREDIT: ${a.imageCredit}`);
  if (!a.qaPassed) console.log(`QA: ${a.qaReport}`);
  console.log(String(a.body).replace(/<a [^>]*href="([^"]+)"[^>]*>/g, "[").replace(/<\/a>/g, "]").replace(/<\/(p|h\d|li)>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n\s*\n+/g, "\n").trim());
  console.log("\n--- SOURCE (first 1500 chars) ---\n" + text.slice(0, 1500));
}
process.exit(0);
