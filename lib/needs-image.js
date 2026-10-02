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
// Published pieces are excluded: the one place a human still swaps a photo in
// afterwards is the headshot loop in lib/headshots.js, which has its own path.
//
// "idea" IS included, and leaving it out was the first mistake here. A person
// story only reaches that status by being retired by the Designer after three
// failed picture searches, body kept. That is not a parked idea nobody wants,
// it is this exact problem, already piled up: on 2 Oct 2026 the five waiting
// were all ideas and a list without them was empty on the day it shipped.
const WORKABLE = ["idea", "drafting", "review", "approved"];

export async function needsImage() {
  const db = fleetRead();
  const rows = await db.article.findMany({
    where: {
      subjectKind: "person",
      imageUrl: null,
      status: { in: WORKABLE },
    },
    select: {
      id: true,
      title: true,
      status: true,
      subjectName: true,
      subjectRole: true,
      subjectOrg: true,
      sourceUrl: true,
      updatedAt: true,
      createdAt: true,
      site: { select: { id: true, slug: true, name: true, accentHex: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
  return rows;
}
