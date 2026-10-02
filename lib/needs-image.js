import { fleetRead } from "./prisma";

// Articles stuck for want of a photograph, across every title.
//
// These exist because of JB's rule of 2 Oct 2026: a story about a named person
// we cannot photograph is held rather than dressed in a generated name card or,
// worse, a stock photo. The hold is deliberate and the pile is the point, but a
// pile nobody can see is just a stalled queue, so this is the queue made
// visible and workable.
//
// DELIBERATELY NARROW. JB: "only where absolutely necessary". This is not every
// article without a picture. The Designer sources its own and retires anything
// it fails on three times, so an imageless article is usually mid-flight and
// listing it would be noise. Only a person story qualifies, because that is the
// only case where no machine is allowed to choose the picture.
//
// Published pieces are excluded, with one exception: anything that went out
// under a generated name card before the rule (imageSource "card:person").
// A sweep on 2 Oct 2026 found six live (Golf 3, Airport 2, Gym 1), and a name
// card on a live page is exactly what the rule exists to stop. A photo dropped
// in replaces the card on the live post (see uploadArticleImage).
//
// "idea" IS included, and leaving it out was the first mistake here. A person
// story only reaches that status by being retired by the Designer after three
// failed picture searches, body kept. That is not a parked idea nobody wants,
// it is this exact problem, already piled up: on 2 Oct 2026 the five waiting
// were all ideas and a list without them was empty on the day it shipped.
const WORKABLE = ["idea", "drafting", "review", "approved"];

// Shared by the list and the nav badge so the two can never disagree.
// subjectKind stays the gate on both arms, so "remove from this list" (which
// sets it to "none") takes a card story off as well as a held one.
const WHERE = {
  subjectKind: "person",
  OR: [
    { imageUrl: null, status: { in: WORKABLE } },
    { imageSource: "card:person", status: { in: [...WORKABLE, "published"] } },
  ],
};

export async function needsImage() {
  const db = fleetRead();
  const rows = await db.article.findMany({
    where: WHERE,
    select: {
      id: true,
      title: true,
      status: true,
      subjectName: true,
      subjectRole: true,
      subjectOrg: true,
      sourceUrl: true,
      imageSource: true,
      wpPostId: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
      site: { select: { id: true, slug: true, name: true, accentHex: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
  return rows;
}

/**
 * Just the number, for the nav badge. Same where clause as the list above,
 * taken from the same constant, so the badge and the page cannot drift apart
 * and tell you different things.
 */
export async function needsImageCount() {
  return fleetRead().article.count({
    where: WHERE,
  });
}
