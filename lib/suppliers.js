// Tag a freshly published article with the suppliers it is about, so it joins
// their pages at /suppliers/<slug>/ on the title. The page side lives in the
// cogent-base theme (inc/suppliers.php); the one-off history pass is
// scripts/backfill-suppliers.mjs, and this applies the same rule going forward.
//
// WHICH PAGES AN ARTICLE JOINS
//   about    = the name (or one of its other names) is in the headline, or the
//              company is the article's feed source, or one the article is
//              about by a reading of it (below), and the name is in the body
//   mention  = the name appears at least twice in the body (once is usually a
//              cross-reference to another story); never for strict names
//
// WHEN A NEW PAGE IS CREATED
//   JB, 18 Nov 2026: "an article about a brand who doesnt currently have a page
//   needs one created". Two sources of candidates:
//     - the company whose press release it is (the feed source), and
//     - the companies a short model reading of the article says it is ABOUT:
//       businesses at the centre of the story, not ones in passing, and never
//       government, regulators, associations, charities, publications or a
//       single venue.
//   Either way the name must be in the headline or twice in the body, and it
//   must not look like a public body. Passing mentions still never create one.
//
// ONE PAGE PER COMPANY
//   JB, 18 Nov 2026: "make sure we're not creating multiple pages for the same
//   brands, ie one with LTD, one with UK". Names are compared on a key with
//   Ltd, Limited, PLC, UK, Group and the like stripped (the MEPCA rule), and on
//   website domain. A new spelling of a company that has a page joins that
//   page and is added to its other names, so it is matched from then on.
//
// A new page gets a website and logo from the company's own site where one can
// be confirmed (lib/supplier-logo.js); otherwise it shows initials.
//
// The list of suppliers, their other names and the strict flag are read from
// the title's own WordPress, so a name an editor adds in wp-admin is matched
// from the next publish on.
//
// Never throws: a tagging failure must not fail a publish.

import Anthropic from "@anthropic-ai/sdk";
import { sourceSupplierProfile, brandLabel, websiteFromLinks } from "./supplier-logo";

const NOT_A_SUPPLIER =
  /press|publication|media|government|policy|tax|regulat|enforcement|trade bod|trade body|association|federation|council|charit|union|parliament|data|statistic|wire|economy|competitor|consumer title/i;

// The same, by name, for a brand with no category. Releases emailed to the
// press desk create their brand with no category, and on 18 Nov 2026 that let
// "Welsh Government" and "Natural England" get supplier pages.
const NOT_A_SUPPLIER_NAME =
  /\b(government|council|ministry|department|agency|authority|commission|association|federation|society|institute|institution|union|parliament|regulator|ombudsman|nhs|ofsted|ofgem|ofcom|hmrc|dvla|dvsa|natural england|historic england|sport england|environment agency|national highways|highways england|network rail|transport for \w+|charity|foundation|university|college)\b/i;
// An association by its initials, which the words above cannot catch.
const KNOWN_BODIES = /^(nasdal|bda|cqc|smmt|bvrla|fta|rha|bgcma|ukha|cpa|nfu|ahdb|cla|ons|ukhsa|dfe|dft|defra)$/i;
// Other publications, by the words in their names ("Athletech News").
const PUBLICATION = /\b(news|magazine|times|journal|gazette|weekly|daily|report|media|press|review|tv|radio)\b/i;
const publicBody = (name) => NOT_A_SUPPLIER_NAME.test(name) || KNOWN_BODIES.test(name.trim()) || PUBLICATION.test(name);
// A single site rather than a business: one course, airport, hotel or
// practice. The model is told to leave these out and in the 18 Nov dry run
// still offered Tiburon Golf Club, Woolfox Golf Club and San Diego
// International Airport. Pages for these exist only where an editor made one.
const VENUE = /\b(golf club|golf course|golf links|golf resort|country club|airport|hotel|care home|nursing home|nursery|dental practice|dental care|surgery|farm)$/i;

const EXTRACT_MODEL = "claude-haiku-4-5";

/**
 * The comparison key for a company name: "Webfleet Ltd", "Webfleet UK" and
 * "webfleet" are one company. Same suffixes as MEPCA's LinkedIn tagging.
 */
export function brandKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/\b(ltd|limited|plc|llp|llc|inc|incorporated|corp|corporation|gmbh|ag|bv|pty|sa|uk|group|holdings|co|company|international|global|worldwide|technologies|technology|software|solutions|systems|vans)\b\.?/g, " ")
    .replace(/\band\s*$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

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
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*(?:\/|,|\band\b)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);

function matcher(name, aliases) {
  const names = [name, ...aliases].filter(Boolean);
  return {
    names,
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
  return out.map((t) => supplierOf(t.id, t.name, t.meta || {}));
}

function supplierOf(id, rawName, meta) {
  const name = String(rawName).replace(/&amp;/g, "&");
  const aliasText = String(meta.cogent_supplier_aliases || "");
  const aliases = aliasText.split(",").map((a) => a.trim()).filter(Boolean);
  const web = brandLabel(meta.cogent_supplier_website || "");
  return {
    id,
    name,
    aliasText,
    strict: meta.cogent_supplier_strict === "1",
    keys: new Set([name, ...aliases].map(brandKey).filter(Boolean)),
    web: web.length >= 4 ? web : "",
    m: matcher(name, aliases),
  };
}

/** The page a company already has, by name key or website domain. */
function existingFor(suppliers, name, website) {
  const k = brandKey(name);
  const web = website ? brandLabel(website) : "";
  return (
    suppliers.find((s) => k && s.keys.has(k)) ||
    (web.length >= 4 ? suppliers.find((s) => s.web === web) : null) ||
    null
  );
}

/**
 * The businesses this article is about, by a short model reading. Empty on
 * any failure: the rest of tagging does not depend on it.
 */
async function aboutCompanies(title, body) {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  try {
    const res = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 10000, maxRetries: 0 }).messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 250,
      system: `You list the businesses a trade news article is ABOUT, for a directory of companies the magazine has covered.

Reply ONLY with JSON: {"companies":[{"name":"...","primary":true|false,"website":"https://... or null"}]}

Include a business only if the story is centrally about it: it announced, launched, won, bought, was bought, opened, closed, partnered, reported results, or is the company the piece profiles. Up to three; usually one. "primary" is true for the one or two the headline and story are built around, false for a business with a real but supporting part (the buyer in a sale, the customer in a contract). A business merely named alongside, quoted, or credited as a source is not listed at all.

Never include: government departments, ministers, councils, regulators and inspectorates, trade associations and federations, charities, universities, unions, other publications or news agencies, statistics bodies, or a single site such as one golf course, one airport, one care home, one nursery, one gym, one dental practice or one farm. A chain or group that owns many sites is a business and counts.

Give the name exactly as the article writes it. Give a website only if the article itself states it. Never invent a name or address. If nothing qualifies, reply {"companies":[]}.`,
      messages: [{ role: "user", content: `Headline: ${title}\n\nArticle:\n${clean(body).slice(0, 4000)}` }],
    });
    const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = JSON.parse((text.match(/\{[\s\S]*\}/) || ["{}"])[0]);
    return (Array.isArray(json.companies) ? json.companies : [])
      .map((c) => ({ name: String(c?.name || "").trim(), primary: c?.primary === true, website: /^https?:\/\//.test(c?.website || "") ? c.website : null }))
      .filter((c) => c.name)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** Add a spelling to a page's other names, so it is matched from now on. */
async function addAlias(wp, s, variant) {
  if (!variant || brandKey(variant) === "" || s.m.names.some((n) => n.toLowerCase() === variant.toLowerCase())) return;
  const aliases = [s.aliasText, variant].filter(Boolean).join(", ");
  await wpFetch(wp, `/cogent_supplier/${s.id}`, {
    method: "POST",
    body: JSON.stringify({ meta: { cogent_supplier_aliases: aliases } }),
  }).catch(() => null);
}

/**
 * Website and logo for a page the publisher created, from the company's own
 * site. Run by /api/cron/supplier-profiles, not at publish: every title
 * publishes inside one 60 second tick, and fetching someone's website must
 * not cost the next title its slot.
 */
export async function fillProfile(wp, termId, name, { website }) {
  const p = await sourceSupplierProfile({ name, website });
  const meta = {};
  if (p.website) meta.cogent_supplier_website = p.website;
  if (p.logo) {
    const { uploadMedia } = await import("./wordpress");
    const slug = brandKey(name) || "supplier";
    const media = await uploadMedia(wp, {
      data: p.logo.png,
      contentType: "image/png",
      alt: `${name} logo`,
      filename: `${slug}-logo`,
    }).catch(() => null);
    if (media?.url) meta.cogent_supplier_logo = media.url;
  }
  // Tried once, whatever the outcome: a page with no logo found stays on
  // initials and is not fetched again every hour.
  meta.cogent_supplier_sourced = `${new Date().toISOString().slice(0, 10)} ${p.note}`.slice(0, 200);
  await wpFetch(wp, `/cogent_supplier/${termId}`, { method: "POST", body: JSON.stringify({ meta }) }).catch(() => null);
  return { website: !!meta.cogent_supplier_website, logo: !!meta.cogent_supplier_logo, note: p.note };
}

/** Pages the publisher created that still want a website and logo. */
export async function profilesDue(wp) {
  const rows = [];
  for (let page = 1; page < 50; page++) {
    const r = await wpFetch(wp, `/cogent_supplier?per_page=100&page=${page}&hide_empty=false&_fields=id,name,meta`).catch(() => []);
    rows.push(...r);
    if (r.length < 100) break;
  }
  return rows
    .filter((t) => t.meta?.cogent_supplier_sourced === "due")
    .map((t) => ({ id: t.id, name: String(t.name).replace(/&amp;/g, "&"), website: t.meta.cogent_supplier_website || null }));
}

/** Start the sourcing run now rather than waiting for the daily one. */
function kickProfiles() {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!base || !process.env.CRON_SECRET) return Promise.resolve();
  // Only the request needs to leave: the run is its own function invocation.
  return fetch(`${base}/api/cron/supplier-profiles`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(2500),
  }).catch(() => null);
}

/**
 * Work out which suppliers a published post belongs to, create a page for a
 * company it is about that has none, and add the post to them.
 *
 * @param wp       the title's WordPress credential
 * @param db       the title's scoped Prisma client (forSite)
 * @param article  the Article row (needs sourceItemId, subjectOrg)
 * @param post     { id } of the WordPress post just published
 * @param title    the headline as published
 * @param body     the body as published (HTML is fine)
 * @param dry      work it out and report, write nothing
 * @returns { about, mentions, created } names, or { error }
 */
export async function tagSuppliers(wp, db, { article, post, title, body, dry = false }) {
  try {
    if (!post?.id) return { skipped: "no post" };
    const head = clean(title);
    const text = clean(body);

    let source = null;
    if (article?.sourceItemId) {
      const item = await db.feedItem
        .findUnique({
          where: { id: article.sourceItemId },
          select: { brand: { select: { name: true, category: true, website: true } } },
        })
        .catch(() => null);
      source = item?.brand || null;
    }
    const read = await aboutCompanies(head, body);

    const suppliers = await loadSuppliers(wp);
    const hintKeys = new Set(
      [...parts(source?.name), ...parts(article?.subjectOrg), ...read.map((c) => c.name)].map(brandKey).filter(Boolean)
    );
    const about = [];
    const mentions = [];
    for (const s of suppliers) {
      const inHead = s.m.one.test(head);
      const inBody = s.m.one.test(text);
      const isSource = [...s.keys].some((k) => hintKeys.has(k));
      if (inHead || (isSource && inBody)) about.push(s);
      else if (!s.strict && (text.match(s.m.all) || []).length >= 2) mentions.push(s);
    }

    // Companies that may need a page: the press release's company (unless its
    // category says it is not a supplier) and the ones the article is about.
    const candidates = [];
    if (source?.name && !/^wire\b/i.test(source.name) && !NOT_A_SUPPLIER.test(source.category || "")) {
      // "Stellantis, Wayve, NVIDIA" and "FleetDue / Widersolutions Limited" are
      // several names in one field, and "KEYper Systems (formerly Traka
      // Automotive)" carries a note: a page is per company, so take each name.
      // An "&" stays: "Christie & Co" and "MAN Truck & Bus" are one company.
      for (const n of parts(source.name)) candidates.push({ name: n, website: source.website || null });
    }
    // Only the businesses the story is built around may get a new page; a
    // supporting one still joins its page if it already has one (above).
    candidates.push(...read.filter((c) => c.primary));

    const created = [];
    const joined = [];
    const seen = new Set();
    for (const { name, website } of candidates) {
      const k = brandKey(name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      if (name.length < 4 || k.length < 3) continue; // "AX", "AA": too short to create safely
      if (publicBody(name) || VENUE.test(name)) continue;
      const m = matcher(name, []);
      // Named in the headline, or at least twice in the body.
      if (!m.one.test(head) && (text.match(m.all) || []).length < 2) continue;

      // Already has a page under another spelling: join it, and teach it this one.
      const have = existingFor([...suppliers, ...created.map((c) => c.s)], name, website);
      if (have) {
        if (!about.includes(have)) about.push(have);
        const i = mentions.indexOf(have);
        if (i >= 0) mentions.splice(i, 1);
        if (have.name.toLowerCase() !== name.toLowerCase()) joined.push(`${name} -> ${have.name}`);
        if (!dry) await addAlias(wp, have, name);
        continue;
      }

      const site = website || websiteFromLinks(name, body);
      const meta = { cogent_supplier_sourced: "due", ...(site ? { cogent_supplier_website: site } : {}) };
      const term = dry ? { id: -1 - created.length, name } : await wpFetch(wp, "/cogent_supplier", { method: "POST", body: JSON.stringify({ name, meta }) }).catch(
        (e) => {
          // "term_exists" means another publish beat us to it; use that one.
          const id = /term_exists/.test(e.message) && (e.message.match(/"term_id":(\d+)/) || [])[1];
          return id ? { id: Number(id), name, existed: true } : null;
        }
      );
      if (!term?.id) continue;
      const s = supplierOf(term.id, name, site ? { cogent_supplier_website: site } : {});
      created.push({ s, name });
    }
    if (created.length && !dry) await kickProfiles();

    const ids = [...new Set([...about, ...mentions].map((s) => s.id).concat(created.map((c) => c.s.id)))];
    if (ids.length) {
      // Merge with anything already on the post rather than replacing it.
      const current = await wpFetch(wp, `/posts/${post.id}?_fields=cogent_supplier`).catch(() => ({}));
      const merged = [...new Set([...(current.cogent_supplier || []), ...ids])];
      if (!dry) await wpFetch(wp, `/posts/${post.id}`, { method: "POST", body: JSON.stringify({ cogent_supplier: merged }) });
    }
    return {
      about: about.map((s) => s.name),
      mentions: mentions.map((s) => s.name),
      created: created.map((c) => c.name),
      ...(joined.length ? { joined } : {}),
      ...(dry ? { read: read.map((c) => c.name + (c.primary ? "*" : "")) } : {}),
    };
  } catch (e) {
    return { error: String(e.message || e).slice(0, 200) };
  }
}

/**
 * Catch-up for posts that reached WordPress without going through a publish
 * route: hand-built scripts, the WordPress editor, a route whose tagging call
 * failed. On 19 Nov 2026 a BrightHR story built by hand never joined the
 * BrightHR page, because only the app's three publish routes called
 * tagSuppliers. Run hourly from /api/cron/supplier-catchup.
 *
 * Looks at posts published in the last `hours`. A post that already carries a
 * supplier is left alone. Every post is read once: the ids checked are kept in
 * the title's engine settings, so a post that is about no supplier costs one
 * short model reading in its life, not one an hour.
 */
const CATCHUP_KEY = "supplier_catchup_seen";

export async function catchUpSuppliers(wp, db, { hours = 72, stop = Date.now() + 60000 } = {}) {
  const after = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const posts = await wpFetch(
    wp,
    `/posts?status=publish&after=${encodeURIComponent(after)}&per_page=50&orderby=date&order=desc&_fields=id,title,content,cogent_supplier`
  );
  const row = await db.engineSetting.findUnique({ where: { key: CATCHUP_KEY } }).catch(() => null);
  let seen = [];
  try { seen = JSON.parse(row?.value || "[]"); } catch {}
  const seenSet = new Set(seen);
  const tagged = [];
  let checked = 0;
  for (const p of posts) {
    if (seenSet.has(p.id)) continue;
    if (Date.now() > stop) break;
    if (!(p.cogent_supplier || []).length) {
      const r = await tagSuppliers(wp, db, { article: null, post: { id: p.id }, title: p.title?.rendered || "", body: p.content?.rendered || "" });
      if (r.error) continue; // not marked seen, so the next run tries again
      if (r.about?.length || r.mentions?.length || r.created?.length) tagged.push({ id: p.id, ...r });
    }
    seenSet.add(p.id);
    seen.push(p.id);
    checked++;
  }
  if (checked) {
    const value = JSON.stringify(seen.slice(-500));
    await db.engineSetting.upsert({ where: { key: CATCHUP_KEY }, update: { value }, create: { key: CATCHUP_KEY, value } });
  }
  return { recent: posts.length, checked, tagged };
}
