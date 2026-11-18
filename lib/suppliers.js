// Tag a freshly published article with the suppliers it is about, so it joins
// their pages at /suppliers/<slug>/ on the title. The page side lives in the
// cogent-base theme (inc/suppliers.php); the one-off history pass is
// scripts/backfill-suppliers.mjs, and this applies the same rule going forward.
//
// THE RULE (JB, 17 Nov 2026). A supplier page is created only when an article
// is ABOUT that company. A passing mention may add an article to a page that
// already exists, but never creates one.
//
//   about    = the name (or one of its other names) is in the headline, or the
//              company is the article's feed source or recorded subject and the
//              name is also in the body
//   mention  = the name appears at least twice in the body (once is usually a
//              cross-reference to another story); never for strict names
//
// The list of suppliers, their other names and the strict flag are read from
// the title's own WordPress, so a name an editor adds in wp-admin is matched
// from the next publish on.
//
// A NEW supplier page is created for the company whose press release the
// article is (JB, 18 Nov 2026: "every time a company has an article uploaded,
// it goes into their supplier page"): the article's feed source, named in the
// headline or at least twice in the body. Government, trade bodies,
// regulators, other publications and news wires never get one, going by the
// source's category in the PR brand list.
//
// Never throws: a tagging failure must not fail a publish.

const NOT_A_SUPPLIER =
  /press|publication|media|government|policy|tax|regulat|enforcement|trade bod|trade body|association|federation|council|charit|union|parliament|data|statistic|wire|economy|competitor|consumer title/i;

// The same, by name, for a brand with no category. Releases emailed to the
// press desk create their brand with no category, and on 18 Nov 2026 that let
// "Welsh Government" and "Natural England" get supplier pages.
const NOT_A_SUPPLIER_NAME =
  /\b(government|council|ministry|department|agency|authority|commission|association|federation|society|institute|institution|union|parliament|regulator|ombudsman|nhs|ofsted|ofgem|ofcom|hmrc|dvla|dvsa|natural england|historic england|sport england|environment agency|charity|foundation)\b/i;
// An association by its initials, which the words above cannot catch.
const KNOWN_BODIES = /^(nasdal|bda|cqc|smmt|bvrla|fta|rha|bgcma|ukha|cpa|nfu|ahdb|cla)$/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const clean = (s) =>
  (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&rsquo;|&#8217;/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ");
const parts = (s) =>
  (s || "")
    .split(/\s*(?:\/|,|\band\b|&|\(|\))\s*/i)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

function matcher(name, aliases) {
  const names = [name, ...aliases].filter(Boolean);
  return {
    names,
    lower: new Set(names.map((n) => n.toLowerCase())),
    one: new RegExp(B + "(?:" + names.map(esc).join("|") + ")" + E, "u"),
    all: new RegExp(B + "(?:" + names.map(esc).join("|") + ")" + E, "gu"),
  };
}

async function wpFetch(wp, path, init = {}) {
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const res = await fetch(`${wp.url.replace(/\/$/, "")}/wp-json/wp/v2${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
      "user-agent": "CogentBot/1.0",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`WP ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

/** Every supplier term on the title, with its matching fields. */
async function loadSuppliers(wp) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const rows = await wpFetch(
      wp,
      `/cogent_supplier?per_page=100&page=${page}&hide_empty=false&_fields=id,name,meta`
    ).catch((e) => {
      // A page past the end is a 400, which is the normal way out of the loop.
      if (/ 400:/.test(e.message)) return [];
      throw e;
    });
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.map((t) => {
    const aliases = String(t.meta?.cogent_supplier_aliases || "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    return {
      id: t.id,
      name: t.name.replace(/&amp;/g, "&"),
      strict: t.meta?.cogent_supplier_strict === "1",
      m: matcher(t.name.replace(/&amp;/g, "&"), aliases),
    };
  });
}

/**
 * Work out which suppliers a published post belongs to, create a page for a
 * new company it is clearly about, and add the post to them.
 *
 * @param wp       the title's WordPress credential
 * @param db       the title's scoped Prisma client (forSite)
 * @param article  the Article row (needs sourceItemId, subjectKind, subjectOrg)
 * @param post     { id } of the WordPress post just published
 * @param title    the headline as published
 * @param body     the body as published (HTML is fine)
 * @returns { about, mentions, created } names, or { error }
 */
export async function tagSuppliers(wp, db, { article, post, title, body }) {
  try {
    if (!post?.id) return { skipped: "no post" };
    const head = clean(title);
    const text = clean(body);

    let source = null;
    if (article?.sourceItemId) {
      const item = await db.feedItem
        .findUnique({ where: { id: article.sourceItemId }, select: { brand: { select: { name: true, category: true } } } })
        .catch(() => null);
      source = item?.brand || null;
    }
    const hints = [...parts(source?.name), ...parts(article?.subjectOrg)];

    const suppliers = await loadSuppliers(wp);
    const about = [];
    const mentions = [];
    for (const s of suppliers) {
      const inHead = s.m.one.test(head);
      const inBody = s.m.one.test(text);
      const isSource = hints.some((h) => s.m.lower.has(h));
      if (inHead || (isSource && inBody)) about.push(s);
      else if (!s.strict && (text.match(s.m.all) || []).length >= 2) mentions.push(s);
    }

    // A company with no page yet: the one whose press release this is.
    const created = [];
    const candidates = [];
    // Only the feed source, and not when its category says it is government,
    // a trade body, a publication or a wire. The recorded subject is not
    // enough on its own: on Fleet it says "company" for DVSA and the SMMT,
    // which are exactly the pages not to make.
    if (source?.name && !/^wire\b/i.test(source.name) && !NOT_A_SUPPLIER.test(source.category || "")) {
      // "Stellantis, Wayve, NVIDIA" and "FleetDue / Widersolutions Limited" are
      // several names in one field, and "KEYper Systems (formerly Traka
      // Automotive)" carries a note: a page is per company, so take each name.
      // An "&" stays: "Christie & Co" and "MAN Truck & Bus" are one company.
      const names = source.name
        .replace(/\([^)]*\)/g, " ")
        .split(/\s*(?:\/|,|\band\b)\s*/i)
        .map((n) => n.trim())
        .filter(Boolean);
      candidates.push(...names);
    }
    for (const name of candidates) {
      if (name.length < 4) continue; // "AX", "AA": too short to create safely
      if (NOT_A_SUPPLIER_NAME.test(name) || KNOWN_BODIES.test(name)) continue;
      const m = matcher(name, []);
      // Named in the headline, or at least twice in the body: their release.
      if (!m.one.test(head) && (text.match(m.all) || []).length < 2) continue;
      if (suppliers.some((s) => s.m.lower.has(name.toLowerCase()))) continue;
      if (created.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
      const term = await wpFetch(wp, "/cogent_supplier", { method: "POST", body: JSON.stringify({ name }) }).catch(
        (e) => {
          // "term_exists" means another publish beat us to it; use that one.
          const id = /term_exists/.test(e.message) && (e.message.match(/"term_id":(\d+)/) || [])[1];
          return id ? { id: Number(id), name } : null;
        }
      );
      if (term?.id) created.push({ id: term.id, name });
    }

    const ids = [...new Set([...about, ...mentions, ...created].map((s) => s.id))];
    if (ids.length) {
      // Merge with anything already on the post rather than replacing it.
      const current = await wpFetch(wp, `/posts/${post.id}?_fields=cogent_supplier`).catch(() => ({}));
      const merged = [...new Set([...(current.cogent_supplier || []), ...ids])];
      await wpFetch(wp, `/posts/${post.id}`, { method: "POST", body: JSON.stringify({ cogent_supplier: merged }) });
    }
    return {
      about: about.map((s) => s.name),
      mentions: mentions.map((s) => s.name),
      created: created.map((s) => s.name),
    };
  } catch (e) {
    return { error: String(e.message || e).slice(0, 200) };
  }
}
