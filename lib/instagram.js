/**
 * One Instagram post a day, through the Make bridge (lib/social-bridge.js).
 *
 * Started for Barbering Business on 22 September 2026: barbers live on
 * Instagram far more than LinkedIn, which was Tom's view when the title's
 * alignment sheet was written. Any title can switch it on by setting
 * "instagram": true in its social_bridge EngineSetting.
 *
 * The picture is the article's own photo, cropped to Instagram's 4:5 portrait
 * and converted to JPEG, which is the only format Instagram accepts. An
 * interview's photo carries the branded overlay (lib/social-overlay). The caption
 * is written for Instagram rather than copied from the article, but only from
 * the headline and standfirst: nothing in it may say more than the article does.
 */

import { runAgent } from "./agents/runtime";
import { forSite } from "./prisma";
import { titleBrief } from "./voice";
import { fetchCandidates } from "./newsletter";
import { bridgeReady, sendToBridge } from "./social-bridge";
import { socialPictureFor } from "./social-overlay";

const POSTED_KEY = "instagram_posted";
const LAST_KEY = "instagram_last_day";

const ukDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const noEmDash = (s = "") => s.replace(/\s*[—–]\s*/g, ", ");

async function readSetting(db, key, fallback) {
  const row = await db.engineSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}
async function writeSetting(db, key, value) {
  await db.engineSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function runInstagram(site, { creds, dryRun = false, force = false } = {}) {
  // A dry run previews even before the account is connected in Make.
  if (!dryRun && !(await bridgeReady(site, "instagram"))) return { skipped: "Instagram not switched on for this title" };
  const db = forSite(site.id);

  // Once a day. The worker calls at midday; a second call the same day is a
  // no-op rather than a second post.
  if (!force && !dryRun && (await readSetting(db, LAST_KEY, "")) === ukDay()) {
    return { skipped: "already posted today" };
  }

  let posted = [];
  try {
    posted = JSON.parse(await readSetting(db, POSTED_KEY, "[]"));
  } catch {}

  const since = Date.now() - 4 * 864e5;
  const pool = (await fetchCandidates(creds?.wordpress, 20, site)).filter(
    (c) =>
      c.imageLead &&
      new Date(c.date).getTime() > since &&
      !posted.includes(c.id) &&
      !(c.tags || []).includes("guest-perspective")
  );
  if (!pool.length) return { skipped: "nothing new with a picture in the last four days" };

  return runAgent(site, "linkedin", "instagram", "Instagram post of the day", async ({ think, progress }) => {
    await progress(`choosing today's Instagram post from ${pool.length} articles`);

    // Two goes before the run counts as a failure. The second costs about a
    // penny; a failure used to park the agent on blocked until the next day.
    let pick = null;
    let caption = "";
    for (let attempt = 1; attempt <= 2 && !(pick && caption.length >= 40); attempt++) {
      if (attempt > 1) await progress("first reply could not be read, asking again");
      const raw = await think({
        system: `${titleBrief(site)}

You run this title's Instagram. Choose the ONE article that will look best and stop a scroll on Instagram: people, shops, cuts and styles, transformations, openings, awards and named businesses beat policy, tax and compliance pieces. Then write its caption.

Caption rules:
- First line is the hook, under 90 characters, no hashtags in it.
- Then ONE short paragraph of two or three sentences that flow together: what the story is and why it matters to the reader. Never one fact per line. Use ONLY facts in the headline and standfirst given. Never add a number, name or claim that is not there.
- Warm, relaxed and friendly, like someone in the trade passing on something good. Never curt or lecturing.
- Then the line: Full story: link in bio
- Then 6 to 10 hashtags relevant to the story and to the trade, on one line.
- British English. No em dashes or en dashes. At most two emoji, none in the hashtags.

Reply with ONLY JSON, no code fence: {"id": <numeric id>, "caption": "..."}`,
        user: pool.map((c) => `${c.id} | ${c.category} | ${c.title} | ${c.excerpt.slice(0, 220)}`).join("\n"),
        maxTokens: 4000,
        model: "claude-sonnet-5",
      });
      ({ pick, caption } = readPick(raw, pool));
    }
    if (!pick || caption.length < 40) throw new Error("could not choose a post or write its caption");
    if (caption.length > 2200) caption = caption.slice(0, 2200);

    // An interview goes out with its branded overlay (lib/social-overlay);
    // anything else, or an overlay that cannot be drawn, with the plain photo.
    const { url: imageUrl } = await socialPictureFor(site, {
      wp: creds?.wordpress,
      wpPostId: pick.id,
      imageUrl: pick.imageLead,
      format: "instagram",
    });
    if (dryRun) return { summary: `Dry run: "${pick.title.slice(0, 60)}"`, wpPostId: pick.id, title: pick.title, imageUrl, caption };

    await sendToBridge(site, { destination: "instagram", caption, imageUrl, link: pick.link, articleTitle: pick.title });
    await writeSetting(db, POSTED_KEY, JSON.stringify([pick.id, ...posted].slice(0, 300)));
    await writeSetting(db, LAST_KEY, ukDay());
    return { summary: `Sent to Instagram: "${pick.title.slice(0, 60)}"`, wpPostId: pick.id };
  });
}

// The model's {"id", "caption"} reply, read leniently. A caption runs to
// several paragraphs, and models often put real line breaks inside the JSON
// string, which JSON.parse rejects outright: that was the "could not choose a
// post" failure that blocked Barbering's Instagram on 6 and 7 Oct 2026. Text
// either side of the object is ignored, and bare line breaks inside strings
// are escaped before a second parse.
function readPick(raw, pool) {
  const text = String(raw || "").replace(/^```(?:json)?|```$/gm, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { pick: null, caption: "" };
  const body = text.slice(start, end + 1);
  let j = null;
  try {
    j = JSON.parse(body);
  } catch {
    try {
      j = JSON.parse(body.replace(/"(?:[^"\\]|\\.)*"/gs, (str) => str.replace(/\r?\n/g, "\\n")));
    } catch {
      return { pick: null, caption: "" };
    }
  }
  const pick = pool.find((c) => String(c.id) === String(j?.id)) || null;
  // A visible blank line between every paragraph, which JB asked for after
  // the first post (22 Sep 2026) ran its lines together. Instagram
  // collapses truly empty lines, so the gap holds a Braille blank (U+2800),
  // which renders as nothing but is not whitespace to Instagram.
  const caption = noEmDash(String(j?.caption || ""))
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n⠀\n");
  return { pick, caption };
}
