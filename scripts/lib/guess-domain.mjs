// Work out a company's website from its name, and prove it before believing it.
//
// Needed because the trade press names an employer far more often than it links
// one, and a row with no domain can never get an address. Guessing a domain is
// cheap; the danger is that a guess lands on a real but different company. That
// has already cost once: tstgroup.com is a different business from the
// tstgroup.uk we wanted, and only checking that the page talked about the right
// sector caught it.
//
// So every candidate is fetched and has to prove itself: the page must mention
// the company's distinctive words. A domain that does not answer, or answers
// without ever naming the company, is discarded rather than returned with a
// caveat nobody will read.

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

// Only legal form and grammar are stripped. An earlier version also stripped
// sector words, which is precisely backwards: "Menzies Aviation" became
// "menzies" and resolved to an accountancy firm of that name, and "Kelly Group"
// became "kelly" and resolved to a staffing agency. The sector word is the
// discriminator, so it stays in both the candidate domain and the proof.
const NOISE = /^(the|and|of|for|a|at|limited|ltd|llp|plc|inc|incorporated|corp|corporation|company|co)$/i;

const words = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function candidateDomains(company) {
  const all = words(company);
  const core = all.filter((w) => !NOISE.test(w) && w.length > 1);
  if (!core.length) return [];

  const joined = core.join("");
  const dashed = core.join("-");
  const firstTwo = core.slice(0, 2).join("");
  const stems = [...new Set([joined, dashed, firstTwo, core[0]])].filter((s) => s.length >= 4 && s.length <= 30);

  const tlds = [".co.uk", ".com", ".uk", ".org.uk", ".org"];
  const out = [];
  for (const s of stems) for (const t of tlds) out.push(s + t);
  return out.slice(0, 14);
}

async function page(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(9000) });
    if (!r.ok) return "";
    const type = r.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(type)) return "";
    return (await r.text()).slice(0, 200000);
  } catch {
    return "";
  }
}

/**
 * The company's own domain, or null.
 *
 * Proof is that the page names the company: every distinctive word from the
 * company name has to appear in the page text. One distinctive word is enough
 * for a single-word name like Mallaghan, but a two-word name has to match both,
 * which is what stops "Kelly Group" matching any page that says "group".
 */
export async function guessDomain(company, { extraProof = [] } = {}) {
  const core = words(company).filter((w) => !NOISE.test(w) && w.length > 2);
  if (!core.length) return null;

  for (const domain of candidateDomains(company)) {
    const html = await page(`https://${domain}/`);
    if (!html) continue;
    const plain = html.replace(/<[^>]+>/g, " ").toLowerCase();
    const hits = core.filter((w) => plain.includes(w)).length;
    if (hits < core.length) continue;
    // An optional second gate for sector words, for the cases where a name is
    // generic enough that naming it proves nothing.
    if (extraProof.length && !extraProof.some((w) => plain.includes(String(w).toLowerCase()))) continue;
    return domain;
  }
  return null;
}
