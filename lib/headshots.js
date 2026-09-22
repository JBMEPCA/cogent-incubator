// Getting a real photo for a story that went out under a name card.
//
// lib/person-image.js leads a person story with a name card when no photo of
// them can be found. That is the fallback JB chose on 22 Sep 2026 (option A):
// publish anyway, write to the company for a headshot, and swap it in when it
// arrives. No human in the loop at either end.
//
// Two halves, run hourly from /api/cron/headshots:
//
//  ask:   a card-led story that is live and recent gets ONE email to the
//         company. The address is the press desk sender's own for a release
//         that came to press@, otherwise the published inbox the contact hunter
//         finds on the organisation's site. Founder addresses are never guessed
//         (docs: they are never published, and the guess fails silently).
//  swap:  a reply in that thread with a photo attached is checked by the same
//         person gate, uploaded, and made the featured image. The card's empty
//         credit gets a "Photo: <org>" line, and the sender is thanked.
//
// Failures are recorded and never retried in a loop: a story with nobody to
// ask is marked asked with no address, and keeps its card.
import { hostOf, imageSize, resolveOwnSite } from "./subject-image";
import { verifyPerson, cropEdgeBand } from "./person-image";

const ASK_PER_RUN = 3;
const ASK_WITHIN_DAYS = 21;
const SWAP_WITHIN_DAYS = 45;

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "them";

function askEmail({ site, a, link, sender }) {
  const who = [a.subjectRole, a.subjectOrg].filter(Boolean).join(" at ");
  return {
    subject: `Photo of ${a.subjectName} for ${site.name}`,
    text: [
      "Hello,",
      "",
      `We have published a news story on ${site.name} about ${a.subjectName}${who ? `, ${who}` : ""}:`,
      link,
      "",
      `We could not find a photo of ${firstName(a.subjectName)} to run with it, so it currently shows a name card. If you reply to this email with a headshot or press photo attached, we will put it on the story. It is free, and there is nothing else to do.`,
      "",
      "Thank you,",
      sender.name,
      site.name,
    ].join("\n"),
  };
}

/** The address to ask, or null. Never a guess. */
async function contactFor(a, log) {
  const item = a.sourceItem;
  // A release sent to press@: the sender, whose details the press desk kept.
  if (item?.link?.startsWith("gmail:") && item.brand?.prContactEmail) {
    return item.brand.prContactEmail;
  }
  if (!a.subjectOrg) return null;
  const ua = "Mozilla/5.0 (compatible; CogentBot/1.0)";
  const own = await resolveOwnSite(a.subjectOrg, ua, log, Date.now() + 15000).catch(() => null);
  if (!own) return null;
  const { huntContact } = await import("./contact-hunt");
  const found = await huntContact(hostOf(own.url)).catch(() => null);
  return found?.email || null;
}

export async function askForHeadshots(site, { db, creds }) {
  const outreach = creds?.outreach;
  const wp = creds?.wordpress;
  const log = (m) => console.log(`[headshots] ${site.slug}: ${m}`);
  const { isGmailConfigured, sendGmail, outreachSender } = await import("./gmail");
  if (!isGmailConfigured(outreach) || !wp?.url) return { asked: 0, note: "no mailbox or WordPress" };

  const due = await db.article.findMany({
    where: {
      status: "published",
      imageSource: "card:person",
      headshotAskedAt: null,
      wpPostId: { not: null },
      subjectName: { not: null },
      publishedAt: { gte: new Date(Date.now() - ASK_WITHIN_DAYS * 86400000) },
    },
    orderBy: { publishedAt: "desc" },
    take: ASK_PER_RUN,
    select: {
      id: true, wpPostId: true, subjectName: true, subjectRole: true, subjectOrg: true,
      sourceItem: { select: { link: true, brand: { select: { prContactEmail: true } } } },
    },
  });

  const { fetchPostRaw } = await import("./wordpress");
  const sender = outreachSender(outreach);
  const notes = [];
  let asked = 0;
  for (const a of due) {
    const to = await contactFor(a, log);
    if (!to) {
      await db.article.update({ where: { id: a.id }, data: { headshotAskedAt: new Date(), headshotAskTo: null } });
      notes.push(`${a.subjectName}: nobody to ask, keeps the card`);
      continue;
    }
    try {
      const { link } = await fetchPostRaw(wp, a.wpPostId);
      const mail = askEmail({ site, a, link, sender });
      const sent = await sendGmail({ outreach, to, subject: mail.subject, text: mail.text });
      await db.article.update({
        where: { id: a.id },
        data: { headshotAskedAt: new Date(), headshotAskTo: to, headshotThreadId: sent.threadId || null },
      });
      asked++;
      notes.push(`${a.subjectName}: asked ${to}`);
    } catch (e) {
      // Marked asked all the same: a send that fails once will fail the same
      // way every hour, and a story with a card is not broken.
      await db.article.update({ where: { id: a.id }, data: { headshotAskedAt: new Date(), headshotAskTo: null } });
      notes.push(`${a.subjectName}: send failed, ${String(e.message).slice(0, 80)}`);
    }
  }
  return { asked, notes };
}

/** Put the photo on the post and the credit where the card had none. */
async function swapIn(wp, a, { data, contentType, alt }) {
  const { uploadMedia, fetchPostRaw, updatePost } = await import("./wordpress");
  const slug = String(a.subjectName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const media = await uploadMedia(wp, { data, contentType, alt, filename: `${slug}-headshot` });
  const credit = `Photo: ${a.subjectOrg || "supplied"}`;
  const post = await fetchPostRaw(wp, a.wpPostId);
  const line = `<p><em style="font-size:0.85em">${credit}</em></p>`;
  const creditRe = /<p><em style="font-size:0\.85em">(Image|Photo):[^<]*<\/em><\/p>/;
  const raw = creditRe.test(post.raw) ? post.raw.replace(creditRe, line) : `${post.raw.trimEnd()}\n${line}`;
  await updatePost(wp, a.wpPostId, { featured_media: media.id, content: raw });
  return { media, credit, link: post.link };
}

export async function swapInHeadshots(site, { db, creds }) {
  const outreach = creds?.outreach;
  const wp = creds?.wordpress;
  const log = (m) => console.log(`[headshots] ${site.slug}: ${m}`);
  const { isGmailConfigured, inboundMatching, imageAttachments, sendGmail } = await import("./gmail");
  if (!isGmailConfigured(outreach) || !wp?.url) return { swapped: 0 };

  const waiting = await db.article.findMany({
    where: {
      imageSource: "card:person",
      headshotAskTo: { not: null },
      headshotSwappedAt: null,
      headshotAskedAt: { gte: new Date(Date.now() - SWAP_WITHIN_DAYS * 86400000) },
    },
    select: { id: true, title: true, wpPostId: true, subjectName: true, subjectRole: true, subjectOrg: true, headshotThreadId: true, headshotAskTo: true },
  });
  if (!waiting.length) return { swapped: 0 };

  // One query for the whole title. A reply can come from a colleague of the
  // address we wrote to, or be forwarded, so the thread and the subject are the
  // keys, never the sender.
  const inbound = await inboundMatching(outreach, `subject:"Photo of" has:attachment newer_than:${SWAP_WITHIN_DAYS}d -from:me`, 25);
  const notes = [];
  let swapped = 0;
  for (const a of waiting) {
    const msgs = inbound.filter((m) =>
      (a.headshotThreadId && m.threadId === a.headshotThreadId) ||
      m.subject.toLowerCase().includes(`photo of ${a.subjectName}`.toLowerCase())
    );
    for (const m of msgs) {
      const shots = await imageAttachments(outreach, m.id, { minBytes: 30000 });
      let done = false;
      for (const shot of shots) {
        const size = imageSize(shot.data);
        if (!size || size.w < 400 || size.h < 400) continue;
        let image = { base64: shot.data.toString("base64"), type: shot.contentType, size };
        let bytes = shot.data;
        let type = shot.contentType;
        const v = await verifyPerson(site, {
          title: a.title,
          name: a.subjectName,
          image,
          evidence: `sent by ${m.fromEmail} in reply to our request for a photo of ${a.subjectName}`,
        }).catch(() => null);
        if (!v || !v.person || v.contradicts || !v.usable || v.mark === "frame") continue;
        if (v.mark === "edge") {
          const cut = await cropEdgeBand(shot.data, v.edge).catch(() => null);
          if (!cut) continue;
          bytes = cut.buffer;
          type = cut.type;
        }
        try {
          const alt = v.alt || [a.subjectName, a.subjectRole].filter(Boolean).join(", ");
          const { link } = await swapIn(wp, a, { data: bytes, contentType: type, alt });
          await db.article.update({
            where: { id: a.id },
            data: { headshotSwappedAt: new Date(), imageSource: `person:supplied`, imageAlt: alt, imageCredit: `Photo: ${a.subjectOrg || "supplied"}` },
          });
          await sendGmail({
            outreach,
            to: m.fromEmail,
            subject: m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`,
            text: `Thank you. The photo is on the story now:\n${link}`,
            inReplyTo: m.messageId,
            threadId: m.threadId,
          }).catch(() => null);
          swapped++;
          notes.push(`${a.subjectName}: photo from ${m.fromEmail} is live`);
          done = true;
          break;
        } catch (e) {
          notes.push(`${a.subjectName}: swap failed, ${String(e.message).slice(0, 80)}`);
          log(`swap failed for ${a.subjectName}: ${e.message}`);
        }
      }
      if (done) break;
    }
  }
  return { swapped, notes };
}
