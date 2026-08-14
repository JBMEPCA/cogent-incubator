import { prisma } from "../prisma";

// Is this topic already covered by something on the site?
//
// Exact title matching is not enough. The Researcher proposes "How to Buy a
// Small Business in the UK: Due Diligence, Valuation and Legal Steps" while the
// site already carries "How to Buy a Small Business in the UK: Due Diligence and
// Legal Steps" — the same article wearing a different hat. On 3 August the
// Director commissioned four such topics in one day, the Editor wrote them, the
// Designer burned three runs finding images for them, and two were queued to
// publish on top of the originals. Nothing in the chain compared a topic against
// what was already live.

const STOP = new Set([
  "the", "and", "for", "your", "what", "how", "uk", "in", "to", "a", "of", "on",
  "is", "are", "with", "you", "guide", "explained", "small", "business", "2026",
]);

function keyWords(title) {
  return new Set(
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

// Overlap against the SHORTER title, not the union. A long headline that fully
// contains a short one is still the same article, and Jaccard would score that
// pair low enough to wave it through.
export function titleOverlap(a, b) {
  const A = keyWords(a);
  const B = keyWords(b);
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / Math.min(A.size, B.size);
}

// Calibrated against the real 3 August clashes and every pair of the 48 live
// titles. The bands overlap: genuine duplicates scored 0.67 to 1.00, and two
// pairs of genuinely different articles also reached 0.60 and 0.67 by sharing a
// phrase ("British Business Bank Backs..."). No single cutoff separates them.
//
// So the split is deliberate rather than tuned. Above CERTAIN, reject outright.
// Between MAYBE and CERTAIN, say nothing automatic and hand it to the Director,
// because that band genuinely needs judgement — "Starting an AI Services
// Business" and "How to Start a Small AI Business" may or may not be the same
// article. Silently rejecting a legitimate topic is the worse failure: nobody
// ever sees it, whereas a duplicate that slips through is visible on the site.
const CERTAIN = 0.7;
const MAYBE = 0.55;

// { certain, maybe } — `certain` is a duplicate to reject outright, `maybe` is
// a near match for the Director to rule on. Checks everything not yet dead, so
// a topic already sitting in the queue is caught as well as one already live;
// otherwise the same idea is commissioned twice before either is published.
export async function coverageCheck(title, { excludeId } = {}) {
  const existing = await prisma.article.findMany({
    where: {
      status: { in: ["drafting", "review", "approved", "published"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, title: true, status: true, wpPostId: true },
  });
  let best = null;
  for (const a of existing) {
    const score = titleOverlap(a.title, title);
    if (!best || score > best.score) best = { ...a, score };
  }
  if (!best) return { certain: null, maybe: null };
  if (best.score >= CERTAIN) return { certain: best, maybe: null };
  if (best.score >= MAYBE) return { certain: null, maybe: best };
  return { certain: null, maybe: null };
}

export async function alreadyCovered(title, opts) {
  return (await coverageCheck(title, opts)).certain;
}
