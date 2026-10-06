// Monday briefing proofs for every title, from snapshots made by _monday-gather.mjs.
// Featured story is an editorial pick for the proof; most read is computed by the rule.
import fs from "node:fs"; import os from "node:os"; import { execFileSync } from "node:child_process";
import { renderBriefing, briefingCampaignId, BRIEFING_TITLES } from "../lib/briefing-template.js";
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const SP = process.argv[2];
const DIST = "../cogent-base-theme/scripts/brand/dist";
const png = (p) => `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;

const PICKS = {
  "smart-sme": { preview: "Plus last week's most read: the minimum wage shake-up, Pet Remedy's King's Award, and HubSpot vs SharpSpring", featured: 1253, subject: "Strike-off objections go online-only",
    logo: "https://mcusercontent.com/c8f19806103281f546fb82fd6/images/f6b97931-4351-10e7-6b90-c4667f889421.png" },
  "fleet-magazine": { preview: "Plus last week's most read: the Guinness trailer theft, Driver CPC card deadlines, and London's freight score", featured: 911, subject: "DfT eases EV chargepoint planning rules", logo: png(`${DIST}/fleet-magazine/wordmark.png`) },
  "golf-resort-magazine": { preview: "Plus last week's most read: UK club buyer demand, Viator's new pricing rules, and Vattanac's Legends Tour", featured: 640, subject: "Firefly Golf Club opens, 150 homesites sold",
    logo: "https://mcusercontent.com/c8f19806103281f546fb82fd6/images/75eace0e-773d-3db8-7c7c-8a801832d472.png" },
  "airport-business-magazine": { preview: "Plus last week's most read: Heinemann at Berlin Brandenburg, EASA's icing report, and the biggest capital programmes", featured: 628, subject: "FAA awards $481m in airport grants", logo: png(`${DIST}/airport-business-magazine/wordmark.png`) },
  "barbering-business": { preview: "Plus last week's most read: Karl Foster in the chair, fit-out ideas, and the real cost of opening a shop", featured: 614, subject: "Barber Registration Bill gets first reading", logo: png(`${DIST}/barbering-business/wordmark.png`),
    note: "Barbering has no Mailchimp audience yet, so this cannot send. Most read is from 18 page views." },
};
const short = (t) => t.replace(/<[^>]+>/g, "").replace(/&#0?38;|&amp;/g, "&").replace(/&#8217;/g, "'").split(": ")[0].replace(/\s+(What|and|With|But)\b.*$/i, "").trim();

for (const slug of process.argv.slice(3)) {
  const snap = JSON.parse(fs.readFileSync(`${SP}/${slug}-snap.json`, "utf8"));
  const pick = PICKS[slug];
  const all = new Map([...snap.recent, ...snap.lookup].map((p) => [p.id, p]));
  const bySlug = new Map(snap.lookup.map((p) => [p.slug, p]));
  const lead = all.get(pick.featured);
  const mostRead = snap.ga
    .map((r) => ({ ...r, post: bySlug.get(r.path.replace(/^\/|\/$/g, "")) }))
    .filter((r) => r.post && r.post.id !== lead.id && !r.post.tags.includes("guest-perspective") && r.post.imageSquare)
    .sort((a, b) => b.views - a.views || b.post.date.localeCompare(a.post.date))
    .slice(0, 3);
  const T = BRIEFING_TITLES[slug];
  const previewText = pick.preview;
  const html = renderBriefing({
    site: snap.site, issueDate: "Monday 14 September 2026", logoUrl: pick.logo,
    campaign: briefingCampaignId(new Date("2026-09-14T06:05:00Z")),
    lead, mostRead: mostRead.map((r) => r.post), previewText, thursday: !!snap.site.newsletterEnabled,
    proof: { fromName: snap.thursday?.fromName || `${snap.site.authorName} | ${snap.site.name}`, subject: `${T.emoji} ${pick.subject}`, time: "07:05", note: pick.note },
  });
  fs.writeFileSync(`assets/newsletter-proofs/${slug}-monday.html`, html);

  // Preview copy with the article images pulled over SSH: this machine is behind
  // SiteGround's captcha, so the live URLs render blank locally.
  const { creds } = await siteCredentials((await prisma.site.findUnique({ where: { slug } })).id);
  const s = creds.sftp;
  const base = ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`];
  const host = snap.site.domain.replace(/\./g, "\.");
  let preview = html;
  const urls = [...new Set([...html.matchAll(new RegExp(`src="(https://(?:www\.)?${host}(/wp-content/uploads/[^"]+))"`, "g"))].map((m) => [m[1], m[2]]))];
  for (const [u, rel] of urls) {
    const b64 = execFileSync("ssh", [...base, `base64 -w0 '${snap.docroot}${rel}'`], { encoding: "utf8", maxBuffer: 50e6 }).trim();
    const type = /\.png$/i.test(rel) ? "png" : /\.webp$/i.test(rel) ? "webp" : "jpeg";
    preview = preview.split(`src="${u}"`).join(`src="data:image/${type};base64,${b64}"`);
  }
  fs.writeFileSync(`assets/newsletter-proofs/${slug}-monday-preview.html`, preview);
  console.log(`\n${snap.site.name}: ${urls.length} images embedded, ${(html.match(/utm_source=/g) || []).length} tagged links, thursday=${!!snap.site.newsletterEnabled}`);
  console.log(`  subject : ${T.emoji} ${pick.subject}`);
  console.log(`  featured: ${lead.title}`);
  mostRead.forEach((r, i) => console.log(`  ${i + 1}. (${r.views} views) ${r.post.title.replace(/<[^>]+>/g, "")}`));
  console.log(`  preview : ${previewText}`);
}
await prisma.$disconnect();
