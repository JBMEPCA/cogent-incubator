// Meet the Operator #1 for Senior Lifestyle Business: Carol Hatcher of The
// Shires, Moseley. Her answers came back to the seven questions we sent on
// 29 Sep 2026, as a .docx rather than an email reply, which is why the
// InterviewTarget row still says "questioned" with an empty replyBody and the
// sweep correctly refused to draft anything.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_carol-hatcher-draft.mjs [--write]
//
// Draft only. JB sees the preview link before anything goes live.
import fs from "node:fs";
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { uploadMedia, publishToWordPress, resolveCategory, authorForSite } from "../lib/wordpress.js";

const WRITE = process.argv.includes("--write");
const IMG = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/shires-media/carol-hatcher-featured.jpg";

const SITE = "https://seniorlifestylebusiness.com";
const TITLE_PLAIN = "Meet the Operator: Carol Hatcher on opening a new village";
const TITLE_WP = '<span class="franchise-eyebrow">Meet the Operator:</span> Carol Hatcher on opening a new village';
const SLUG = "meet-the-operator-carol-hatcher-on-opening-a-new-village";
const META = "Carol Hatcher runs The Shires in Moseley for a small charitable housing association. She joined the project when the building was one brick high.";

const q = (s) => `<blockquote class="wp-block-quote interview-quote">\n<p>${s}</p>\n</blockquote>`;
const h = (s) => `<h2 class="wp-block-heading">${s}</h2>`;

const BODY = [
`<section class="interview-company">
<div class="interview-company-head">
<h2>Who are The Shires?</h2>
</div>
<p>The Shires is a retirement village of 72 one and two bedroom apartments in Moseley, Birmingham, opened in 2023 and owned by the Michael Blanning Housing Association, a small charitable landlord. It has a bistro, a lounge bar, a village hall, a wellbeing room and its own gardens, and it runs more than 25 resident activities a week.</p>
<dl>
<div>
<dt>Company</dt>
<dd>The Shires</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="https://shires-moseley.co.uk/">shires-moseley.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Retirement living</dd>
</div>
<div>
<dt>Based</dt>
<dd>Moseley, Birmingham</dd>
</div>
</dl>
</section>`,

`<p>Most new retirement villages are built by operators with a development arm and a regional structure above them. <a href="https://shires-moseley.co.uk/">The Shires</a> in Moseley was built by a small charitable housing association, and the person who now runs it was there from the start of construction. Carol Hatcher is its general manager. She took us through what a charitable owner changes, what filling a brand new village actually involves, and the part of the job nobody warns you about.</p>`,

h("A short line between a resident and a decision"),
`<p>The first difference Hatcher names is not money or scale. It is distance.</p>`,
q("We don&#8217;t have layer upon layer of management between a resident and the person making the decision. If something isn&#8217;t working, residents can tell me, and I can actually do something about it."),
`<p>That shortens the loop on the small operational calls that make up most of a village manager&#8217;s week.</p>`,
q("We can make decisions based on what is actually happening in the village rather than what a spreadsheet says should be happening."),
`<p>The association&#8217;s board meets at The Shires every month, and the staff team has turned over very little since opening. Hatcher treats that stability as an operational asset rather than a nice-to-have.</p>`,
q("Our residents know who to speak to, and our staff genuinely care about the people they are looking after. That sense of familiarity, trust and accountability is a huge part of what makes The Shires feel like a welcoming community."),

h("From one brick high"),
`<p>The village opened in 2023. Asked what filling a brand new building taught her, Hatcher is blunt about the easy part.</p>`,
q("That opening the doors is the easy bit!"),
q("Trying to create a community while simultaneously running multiple businesses, is quite an experience. You are trying to sell apartments, recruit staff, establish systems, build relationships with residents, create activities and hospitality, and deal with contractors, sometimes all before you&#8217;ve had your first cup of tea!"),
`<p>The decision she credits most is one taken by the housing association before there was a building to manage. It brought in operational experience during development rather than at handover.</p>`,
q("I have been involved with the building from the very beginning, quite literally, from when it was one brick high. Being part of the project throughout construction meant I was able to influence operational decisions as the building developed, rather than trying to make a finished building work around us."),
`<p>That is the transferable point for anyone with a scheme in planning. The test she applied was not how the building looked on a drawing.</p>`,
q("I could look at everything from the perspective of the staff and residents who would ultimately use it and ask, &#8220;Will this actually work in practice?&#8221;"),

h("Ask the residents, then actually listen"),
`<p>The Shires runs more than 25 activities a week. Hatcher&#8217;s method for deciding what goes on the programme is less sophisticated than it sounds, and deliberately so.</p>`,
q("You ask them, and then you actually listen to the answer!"),
`<p>Residents suggest and lead activities themselves, with Stuart Hancock as activity lead. The programme is shaped around how people actually live rather than how a brochure says they should.</p>`,
q("He knows the residents so well, and knows that in our village there is no point putting any activity on before 11am. We are not early risers here at The Shires!"),
`<p>Hatcher is clear about where the operator&#8217;s job stops.</p>`,
q("Our role is not to tell residents how they should spend their time or what their community should look like. It is to create the environment, opportunities and support that allow them to shape it themselves."),
`<p>Asked what she is proudest of, she does not pick a facility.</p>`,
q("We have residents who have arrived as complete strangers and now meet up every day, organise activities together and genuinely look out for one another. That&#8217;s probably the thing I&#8217;m proudest of."),

h("Why the bistro earns its space"),
`<p>The village bistro has been shortlisted for hospitality in its own right. Hatcher argues the catering line is doing more work than a catering line usually does.</p>`,
q("Because food is never just about food."),
q("It gives people a reason to come out of their apartment, sit down with someone and have a conversation, and it is often where friendships develop. Someone might come down for lunch and end up sitting with people they didn&#8217;t know six months earlier."),
`<p>Nutrition is the second argument, and Hatcher says the approach was recognised when the village featured in the BBC&#8217;s Age Well with Your Food coverage. The village garden feeds the kitchen directly.</p>`,
q("There is something particularly rewarding about seeing produce grown by the village gardening group become part of a meal enjoyed by residents in the bistro. It creates a genuine connection between our garden, our kitchen and the people who live here."),
q("For us, hospitality is about creating that feeling of home. A good meal, a familiar face and an interesting conversation can be just as important to someone&#8217;s wellbeing as any formal activity or amenity we provide."),

h("Drains, boilers and an inexplicable smell"),
`<p>A good day, Hatcher says, is one where a resident stops her to report something good rather than something broken. A bad one has a recognisable opening line.</p>`,
q("A bad day usually starts with the words, &#8220;Carol, we&#8217;ve got a bit of a problem...&#8221; And in a retirement village, &#8220;a bit of a problem&#8221; can mean absolutely anything!"),
`<p>Asked what the least glamorous part of the job is, she gives the answer most operators will recognise and few brochures mention.</p>`,
q("Nobody tells you quite how much of your working life will involve drains, boilers, bins, fire alarms, contractors and trying to work out where an inexplicable smell is coming from! You become part manager, part detective, part engineer and occasionally, part plumber."),
q("You cannot run a retirement village from behind a desk. You have to be visible, practical and willing to get involved."),
`<p>She reduces the job to three dependencies.</p>`,
q("If you manage a building, you need to understand the building. If you manage a team, you need to understand your people. And if you manage a community, you need to understand your residents."),

h("Where The Shires goes next"),
`<p>Hatcher says the village is shortlisted for six awards at this year&#8217;s senior housing awards. She is careful about what that is worth.</p>`,
q("Awards are a reflection of what has already happened. They aren&#8217;t the destination."),
`<p>The stated ambition is about demand rather than recognition, and about changing why somebody moves at all.</p>`,
q("I want The Shires to continue developing as a genuinely outstanding place to live, somewhere people choose not because they think they have to move into a retirement village, but because they want to."),
`<p>For a village two years old, the measure she sets is a simple one.</p>`,
q("I want people to walk through the doors and think, &#8220;I could see myself being very happy here.&#8221;"),

`<p><em><a href="${SITE}/meet-the-operator/">Meet the Operator</a> profiles the people who run the retirement communities we cover. Answers have been lightly edited for clarity.</em></p>`,
].join("\n");

console.log(`title    ${TITLE_PLAIN}  (${TITLE_PLAIN.length} chars)`);
console.log(`slug     ${SLUG}`);
console.log(`meta     ${META}  (${META.length} chars)`);
console.log(`body     ${BODY.length} chars, ${(BODY.match(/<blockquote/g) || []).length} quotes, ${(BODY.match(/<h2 class/g) || []).length} sections`);
const dashes = BODY.match(/[\u2014\u2013]/g);
console.log(`dashes   ${dashes ? "FOUND " + dashes.length : "none"}`);
if (!WRITE) {
  fs.writeFileSync("C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/carol-draft-body.html", BODY);
  console.log("\nDRY RUN. Body written to the scratchpad. Re-run with --write to create the WordPress draft.");
  await prisma.$disconnect();
  process.exit(0);
}

const site = await prisma.site.findUnique({ where: { slug: "senior-lifestyle-business" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const wp = creds.wordpress;

const media = await uploadMedia(wp, {
  data: fs.readFileSync(IMG),
  contentType: "image/jpeg",
  filename: "carol-hatcher-the-shires.jpg",
  alt: "Carol Hatcher, general manager of The Shires retirement village in Moseley",
  caption: "Carol Hatcher, general manager at The Shires. Photograph supplied by The Shires.",
});
console.log(`\nmedia    ${media.id}  ${media.source_url}`);

const categoryId = await resolveCategory(wp, "Operators & Economics");
const authorId = await authorForSite(wp, site);

const post = await publishToWordPress(wp, {
  title: TITLE_WP,
  slug: SLUG,
  body: BODY,
  status: "draft",
  featuredMediaId: media.id,
  categoryId,
  authorId,
  keyphrase: "retirement village general manager",
  metaDesc: META,
  seoTitle: TITLE_PLAIN,
});
console.log(`post     ${post.id}  status=${post.status}`);
console.log(`preview  ${SITE}/?p=${post.id}&preview=true`);

const target = await db.interviewTarget.findFirst({ where: { personName: "Carol Hatcher" } });
if (target) {
  await db.interviewTarget.update({
    where: { id: target.id },
    data: {
      status: "answered",
      answeredAt: new Date(),
      replyBody: fs.readFileSync("C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/carol-answers.txt", "utf8"),
      headshotUrl: media.source_url,
    },
  });
  console.log(`target   ${target.id} -> answered, replyBody recorded, headshot stored`);
}
await prisma.$disconnect();
