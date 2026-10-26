/**
 * Rebuild two Gym Champions DRAFTS in the Q&A format the drafter has used
 * since 5 Oct 2026 (a801d54, Tom's feedback): bold standfirst, short intro,
 * each question as p.interview-q, the subject's answer verbatim beneath it,
 * and two or three .interview-quote--pull speech bubbles spread through.
 *
 * JB, 8 Oct 2026: "why arent the answers in speech bubbles like normal". The
 * first hand builds (_build-ferguson-fitness-interview.mjs,
 * _build-carters-gym-interview.mjs) used the pre-5 Oct prose-and-quotes shape.
 *
 * Only post_content changes. Titles, slugs, excerpts, Yoast fields and
 * featured images stay as they are. Both posts must still be drafts.
 *
 * Answers are copied from the replies with punctuation-only edits, listed per
 * piece below; the closing line says so, as the drafter's does.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_qa-rebuild-gym-drafts.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const HUB = "https://gymbusinessnews.com/gym-champions/";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const t = (s) => esc(s).replace(/'/g, "&#8217;");

function card({ company, logo, blurb, website, domain, sector, based }) {
  return `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are ${t(company)}?</h2>${logo ? `\n<img class="interview-company-logo" src="${logo.url}" alt="${t(company)}" width="${logo.w}" height="${logo.h}" loading="lazy" decoding="async">` : ""}
</div>
<p>${t(blurb)}</p>
<dl>
<div><dt>Company</dt><dd>${t(company)}</dd></div>
<div><dt>Website</dt><dd><a href="${website}">${domain}</a></dd></div>
<div><dt>Sector</dt><dd>${t(sector)}</dd></div>
<div><dt>Based</dt><dd>${t(based)}</dd></div>
</dl>
</section>`;
}

// qa: [{ q, a: [paras], pull?: "line from the answer" }]
function build({ cardHtml, standfirst, intro, qa }) {
  for (const item of qa) if (item.pull && !item.a.join(" ").includes(item.pull)) throw new Error(`pull not in its answer: ${item.pull.slice(0, 50)}`);
  return [
    cardHtml,
    `<p><strong>${t(standfirst)}</strong></p>`,
    ...intro.map((x) => `<p>${x}</p>`),
    ...qa.flatMap((item) => [
      `<p class="interview-q"><strong>${t(item.q)}</strong></p>`,
      ...item.a.map((x) => `<p>${t(x)}</p>`),
      item.pull ? `<blockquote class="wp-block-quote interview-quote interview-quote--pull"><p>${t(item.pull)}</p></blockquote>` : "",
    ]),
    `<p><em><a href="${HUB}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for punctuation only.</em></p>`,
  ].filter(Boolean).join("\n\n");
}

// ---- Ferguson Fitness HQ (post 141). Edits: "two much" to "too much", two
// missing spaces after full stops, a colon before the list in answer 6.
const FERG = {
  id: 141,
  body: (logo) => build({
    cardHtml: card({
      company: "Ferguson Fitness HQ", logo: null, website: "https://fergusonfitnesshq.co.uk/", domain: "fergusonfitnesshq.co.uk",
      blurb: "Ferguson Fitness HQ is a functional fitness gym on an industrial estate in Hexham, Northumberland, opened by Matty Ferguson in July 2023. It is an ATHX affiliate, and a finalist for Functional Training Gym of the Year at the 2026 National Fitness Awards.",
      sector: "Functional fitness gym", based: "Hexham, Northumberland",
    }),
    standfirst: "Three years after opening on an industrial estate in Hexham, Matty Ferguson is a national awards finalist, in a town where rent and rates swallow more than a quarter of what the gym takes.",
    intro: [
      `Matty Ferguson opened <a href="https://fergusonfitnesshq.co.uk/">Ferguson Fitness HQ</a> in July 2023, in his early twenties. The gym is now a finalist for Functional Training Gym of the Year at the 2026 National Fitness Awards. He told us what he got wrong, what the location costs him, and why his own training has gone backwards.`,
    ],
    qa: [
      { q: "You opened in July 2023 in your early twenties. What did you get wrong in the first year that you would never do again?",
        a: ["One of the things as a gym owner I believe went wrong was trying and doing everything. We opened all day every day and had to cut back. This was too much for a small team to manage and we weren't utilizing our time efficiently keeping the gym open in quieter times. This time was better spent going through cleaning, email follow ups and equipment maintenance which in the long run actually made our service better!"] },
      { q: "Hexham is a market town, not a city. How big can a functional training gym realistically get in a place that size?",
        a: [
          "Hexham is a small market town with a population of no more than 12,000 people. This means we have a relatively small catchment area from which to attract new members to our gym. With Hexham being recognised as the happiest place to live in England in 2019, demand for property and business premises is high, meaning our rent and business rates are extremely expensive. In fact, over a quarter of our income is spent on these costs.",
          "This has meant that we have had to think differently about how we attract people, generate income and build awareness of Ferguson Fitness HQ within the local community. One of the ways we have achieved this is through organising charity and community events (Sport Tynedale), raising money for local sports clubs and organisations in the area. These events allow us to support the community that supports us, while also bringing people through our doors and introducing them to what we do.",
          "For us, this is about much more than simply gaining new members. We want Ferguson Fitness HQ to be a genuine hub for the local community, a place where people can train, build relationships and feel part of something. By supporting local clubs, charities and community initiatives, we have been able to build strong relationships and establish our gym as a business that gives back to the area in which it operates.",
        ],
        pull: "In fact, over a quarter of our income is spent on these costs." },
      { q: "Functional training is a crowded label now. What do members actually get from you that they would not get elsewhere?",
        a: [
          "Functional fitness has become a crowded market, but we see that as a positive rather than a problem. There is a reason so many gyms have adopted functional training as it works, and it's relevant to almost everyone, regardless of age, ability or fitness level. The ability to build strength, improve mobility, fitness, balance and confidence makes functional training something people can benefit from throughout any stage of their lives.",
          "We are currently the only dedicated functional fitness gym and ATHX affiliate between Carlisle and Newcastle, giving people in Hexham and the surrounding communities access to this style of training without having to travel significant distances. The saturation of the functional fitness market tells us there is a genuine demand for what we do. Our opportunity has been to bring that demand to Hexham and the wider Tynedale area, and to create a community around it. We aren't trying to be another functional fitness gym, we are trying to be the place people in our area come to when they want to become stronger, fitter and more capable for everyday life.",
        ] },
      { q: "When did you stop being the only coach on the floor, and how did you decide who to trust with your members?",
        a: ["We stopped being the only coach on the floor after around six months in our original premises. Our first coach was actually one of our first ever members, which was a really important decision for us. Having experienced the gym first hand as a member, she already understood the product we delivered, the standards we expected and, most importantly, how we wanted our members to feel when they walked through the door. As we have grown, that has remained an important part of how we choose people as our second coach followed the same process."],
        pull: "Our first coach was actually one of our first ever members, which was a really important decision for us." },
      { q: "Industrial estate units are cheap for a reason. What has the location helped with, and what has it cost you?",
        a: [
          "Industrial units are often described as a cheaper option, but that isn't necessarily the reality anymore. Commercial and industrial property has become increasingly competitive, particularly since COVID, and finding the right space at the right price has been one of the biggest challenges of growing Ferguson Fitness HQ.",
          "A functional fitness gym also requires a very different type of premises to a traditional gym. We need significant floor space, high ceilings, storage and enough room for equipment such as Concept2 ergs, barbells, bumper plates, rigs and other functional training equipment. Building a high-quality facility with high quality brands to the standard we expect is a significant investment, particularly with equipment and construction costs increasing since COVID.",
          "We are, however, very fortunate with our location. We are based on an industrial estate less than 1km from the A69, the main road connecting Hexham with the wider region, and just over 1km from Hexham town centre. This makes us highly accessible to people travelling by car, while also being close enough for members to walk or cycle to the gym. The local bus also stops at the bottom of our road, meaning that members without access to a car can still get to us easily.",
        ] },
      { q: "What is the least glamorous part of running a gym that nobody warns you about?",
        a: [
          "The least glamorous part of running a gym is realising that you are never completely off the clock and that sometimes, your own fitness has to take a back seat. Since opening Ferguson Fitness HQ three years ago, my own training and fitness have actually decreased. Before opening the gym, training was a much bigger part of my day and my own fitness was a bigger priority. Now, my role is very different. My focus has to be on looking after our members, making sure their training is planned and delivered properly, supporting the team and dealing with everything that comes with running a business.",
          "We also recently had our first holiday abroad since opening Ferguson Fitness HQ three years ago. We have built a fantastic team around us, which has made it possible for us to step away and take some proper time off, but even when you're on holiday, the business doesn't completely switch off. Running a gym isn't just about coaching sessions and seeing members train. There is a huge amount of work behind the scenes that members never see: managing staff, dealing with suppliers, maintaining equipment, finances, marketing, programming, cleaning, customer service and constantly thinking about what needs to happen next.",
        ],
        pull: "Since opening Ferguson Fitness HQ three years ago, my own training and fitness have actually decreased." },
      { q: "Where does Ferguson Fitness HQ go from here?",
        a: ["Our ambition for Ferguson Fitness HQ is simple: we want to become the benchmark for functional fitness in our region. We don't want to grow just for the sake of being bigger. We want to grow sustainably, protect the culture we have built and continue delivering the level of coaching and member experience that got us here in the first place."] },
    ],
  }),
};

// ---- Carter's Gym (post 134). Hannah answered five of the seven questions
// (not Weights for Women capacity, not how she and Josh split the work); her
// numbering 1-5 maps to our 1, 2, 5, 6, 7. No edits needed beyond quote marks.
const CARTER = {
  id: 134,
  body: (logo) => build({
    cardHtml: card({
      company: "Carter's Gym", logo, website: "https://cartersgym.com/", domain: "cartersgym.com",
      blurb: "Carter's Gym is an independent strength gym in North Walsham, Norfolk, opened in 2025 and run by joint owners Hannah Carter and Josh. It runs women's only weights sessions and menopause sessions alongside general membership, and is a Newcomer of the Year finalist at the 2026 National Fitness Awards.",
      sector: "Independent strength gym", based: "North Walsham, Norfolk",
    }),
    standfirst: "Hannah Carter and Josh opened a weights gym in a Norfolk market town, signed 85 members within weeks and are award finalists in their first year, after building the place around what puts people off strength training.",
    intro: [
      `<a href="https://cartersgym.com/">Carter's Gym</a> is a Newcomer of the Year finalist at the 2026 National Fitness Awards and won a Rising Stars award at Inspire North Norfolk 2026. Hannah and Josh own it jointly; as Hannah puts it, the gym just shares her surname. She answered our questions for both of them.`,
    ],
    qa: [
      { q: "You opened a weights focused gym in a market town. What made you sure North Walsham needed one?",
        a: ["North Walsham has a large population and although there are two leisure facilities in the town, we knew there was a gap for a more personal, strength based gym. We spoke to people in the town and surrounding areas about what might put them off strength training, so we could base our business off the needs of the community. That's why we run women's only weights sessions, menopause sessions and make sure we are always on hand to give free support and advice. We are constantly thinking of ways to try and make people feel more comfortable in a gym environment, for example, we have started Carter's QR codes which take you to a video of Josh and I setting up and talking you through a piece of equipment or exercise."],
        pull: "We spoke to people in the town and surrounding areas about what might put them off strength training, so we could base our business off the needs of the community." },
      { q: "You signed 85 members within weeks. Where did those first people actually come from?",
        a: ["Our members came to Carter's as they were either unhappy at their current facility or had never been to a gym, but wanted to start weight training. Many liked our inclusive ethos, so we got a good amount of interest from the beginning. We have members travel from various areas of North Norfolk."] },
      { q: "You used council mentoring and a digital grant early on. What was the single most useful piece of advice you got?",
        a: ["Plan for the worst case scenario! Opening Carter's was a scary move for us. Although we knew we were hard workers and had thorough plans of what we wanted to do with a gym, we weren't sure if we would actually get a good response. So we had to expect a slow take up and have tough conversations on whether we should set up the business or not."],
        pull: "Plan for the worst case scenario!" },
      { q: "What is the least glamorous part of running a gym that nobody warns you about?",
        a: ["We knew the hours were going to be long, we both work about 70 hours a week and have so far maintained this for 15 months! Our days tend to be full with classes, PT sessions, inductions, cleaning, admin and lovely chats with members. But it is the hours when we are not at work that can be the hardest. Trying to make conversation that is not about the gym or find the energy to do house chores. It is very tricky to still see friends, family and maintain a relationship, but luckily most people are very supportive of what we are doing!"],
        pull: "But it is the hours when we are not at work that can be the hardest." },
      { q: "Where does Carter's Gym go from here?",
        a: ["We've got so much planned for Carter's! We're going to keep our cards close to our chest at the moment, but changes are definitely coming soon. We have a clear vision for what we want to achieve, but our main goal is to keep listening to our members and the North Walsham community and act on what they need."] },
    ],
  }),
};

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);
const db = forSite(site.id);

// Carter's logo was uploaded as media 138 by the first build.
const carterLogo = { url: wp(`post get 138 --field=guid`), w: 201, h: 240 };

for (const [piece, logo] of [[FERG, null], [CARTER, carterLogo]]) {
  const status = wp(`post get ${piece.id} --field=post_status`);
  if (status !== "draft") throw new Error(`post ${piece.id} is ${status}; not touching it`);
  const body = piece.body(logo);
  if (/[—–]/.test(body)) throw new Error(`dash in ${piece.id}`);
  const pulls = (body.match(/interview-quote--pull/g) || []).length;
  const stamp = Date.now();
  ssh(`base64 -d > /tmp/qa-${piece.id}-${stamp}.html`, Buffer.from(body, "utf8").toString("base64"));
  wp(`post update ${piece.id} /tmp/qa-${piece.id}-${stamp}.html`);
  ssh(`rm -f /tmp/qa-${piece.id}-${stamp}.html`);
  const art = await db.article.findFirst({ where: { wpPostId: piece.id } });
  if (art) await db.article.update({ where: { id: art.id }, data: { body } });
  console.log(`post ${piece.id}: Q&A rebuilt, ${pulls} bubbles, ~${body.replace(/<[^>]+>/g, " ").split(/\s+/).length} words`);
}
await prisma.$disconnect();
