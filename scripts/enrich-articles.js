// Bring existing published articles up to the house benchmark: ~2,000+ words,
// real structure, a comparison table, an FAQ, validated internal links, and a
// high-resolution header image.
//
// Rewrites are conservative about facts: every claim already in the post is
// preserved verbatim in meaning, and the model is forbidden from inventing new
// statistics, prices, dates, quotes or named customers. Depth comes from
// structure, explanation and practical guidance, never from fabrication.
//
// Slugs and publish dates are never touched, so permalinks and existing
// rankings survive the pass.
//
//   node scripts/enrich-articles.js            # everything below benchmark
//   node scripts/enrich-articles.js 51 55      # only these post IDs
//   node scripts/enrich-articles.js --images   # image-only refresh, no rewrite
const fs = require("fs");
const path = require("path");
const {
  prisma, log, ask, field, headerLine, stripDashes, clean,
  livePosts, linkBlock, knownUrlSet, uploadMedia, updatePost, chooseImage,
} = require("./publish-lib");

const STATE = path.join(__dirname, ".enrich-state.json");
const BENCH = { words: 1900, h2: 8, tables: 1, internal: 4, imageWidth: 1400 };

/* ------------------------------------------------------------------- audit */

function metrics(post) {
  const html = post.content.rendered;
  const hrefs = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
  return {
    words: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length,
    h2: (html.match(/<h2/gi) || []).length,
    tables: (html.match(/<table/gi) || []).length,
    internal: hrefs.filter((h) => /smartsme\.co\.uk/.test(h)).length,
    outbound: hrefs.filter((h) => /^https?:/.test(h) && !/smartsme\.co\.uk/.test(h)).length,
    faq: /<h2[^>]*>[^<]*(FAQ|Frequently asked|Common questions)/i.test(html),
  };
}

async function mediaInfo(id) {
  if (!id) return { width: 0, url: null };
  try {
    const { wpHeaders, wpBase } = require("./publish-lib");
    const m = await (
      await fetch(`${wpBase()}/media/${id}?_fields=media_details,source_url,alt_text`, { headers: wpHeaders() })
    ).json();
    return { width: m.media_details?.width || 0, url: m.source_url, alt: m.alt_text };
  } catch {
    return { width: 0, url: null };
  }
}

/* ---------------------------------------------------------------- rewriting */

const HOUSE_STYLE = `You write for Smart SME Magazine, "The UK's publication for smart SMEs".
Audience: UK small and medium business owners and owner-managers adopting AI, software and automation.
Voice: plain English, specific, practical, confident without hype. UK spelling and UK context throughout.
Short paragraphs of two to four sentences. Explain jargon on first use. Every section must answer
"what does this mean for my business, and what do I do about it?".

HARD RULES
1. NEVER use em dashes or en dashes anywhere: not in the headline, body, or metadata. Use commas,
   full stops, colons, semicolons or brackets. Hyphens inside compound words are fine.
2. NEVER invent statistics, survey findings, prices you cannot stand behind, quotes, or named case
   studies. Describe pricing as approximate and note it can change.
3. Do not pad. Every paragraph must carry information a reader could act on.
4. No "In today's fast-paced world" openings, no "delve", "landscape", "leverage", "robust",
   "seamless", "game-changer", "unlock", "elevate".
5. Do not repeat the headline as an H1. The page template already prints the title.

LINKING (mandatory, exact URLs from the supplied list only)
- Internal links woven into sentences with descriptive anchor text. Never "click here", never a bare
  URL, never a "related reading" dump.
- Outbound links to authoritative primary sources (gov.uk, hmrc, ico.org.uk, ncsc.gov.uk, the vendor's
  own page). Never link a source you are not certain exists.

OUTPUT
Return these header lines, then the article as clean WordPress-ready HTML using <h2>, <h3>, <p>,
<ul>, <ol>, <li>, <table>, <strong> and <a href>. No markdown, no code fences, no H1.
KEYPHRASE: <Yoast focus keyphrase, 2-5 words, present in the first paragraph>
META_DESC: <meta description, 120-155 characters, contains the keyphrase>
IMAGE_QUERY: <2-4 words describing the ideal header photograph>`;

// Some topics ARE their specifics: a Making Tax Digital guide that never states
// a threshold or a date is structurally complete and useless. For those, verified
// primary-source facts are supplied so the model can be concrete without
// inventing anything. Everything outside this block stays forbidden.
function factBlock(postId) {
  const file = path.join(__dirname, "enrich-facts.json");
  if (!fs.existsSync(file)) return "";
  const entry = JSON.parse(fs.readFileSync(file, "utf8"))[String(postId)];
  if (!entry) return "";
  return `

VERIFIED SOURCE FACTS (checked against the cited pages on ${entry.verifiedOn}).
You MUST state these specifically: they are the substance a reader came for, and a guide on
${entry.topic} that omits them has failed. Cite the source URL when you use them. You still may not
invent any figure, date or threshold beyond this list.
${entry.facts.map((f) => `- ${f}`).join("\n")}
Sources to link:
${entry.sources.map((s) => `- ${s}`).join("\n")}`;
}

function rewritePrompt(post, existingHtml, links) {
  return `Below is a published Smart SME article that is too thin. Rewrite it as a definitive guide of 2,000 to 2,600 words that fully delivers on its headline.

HEADLINE (do not change it, and do not restate it as a heading): ${clean(post.title.rendered)}

THE FACTUAL RULE, which matters more than length:
- Preserve the existing article's angle, and preserve every factual claim it already makes.
- Do NOT introduce new statistics, survey findings, percentages, specific prices, dates, quotes, named
  customers or case studies that are not in the original. If a number would strengthen a point and you
  do not have a verifiable one, make the point qualitatively instead.
- THE ONE EXCEPTION: if a "VERIFIED SOURCE FACTS" block appears at the end of this brief, those facts
  have been checked against the cited primary sources. You must state them specifically and cite the
  source. Nothing outside that block is exempt from the rule above.
- Where the original references a specific news event, product launch or announcement, keep that
  reference exactly as scoped. Do not extend or embellish what was announced.
- Depth must come from explanation, structure, worked reasoning and practical guidance, never from
  invented specifics.

STRUCTURE TO HIT:
- First two paragraphs answer the question the headline implies. No preamble.
- At least 8 <h2> sections, with <h3> subsections where a section has distinct parts.
- At least one real <table> comparing options or laying out a plan, with a header row and a "best for"
  or "when to use it" column. Five columns maximum so it reads on a phone.
- A short section on the mistakes people actually make.
- An FAQ of 5 genuine questions readers ask, each an <h3> with a two to four sentence answer.
- Close with an <h2> "What to do next" of 3 or 4 numbered, specific steps.
- 4 to 6 internal links from the list below, woven into sentences. 2 to 3 outbound links to
  authoritative primary sources.

EXISTING ARTICLE (preserve its claims and angle, expand everything else):
${existingHtml}

Existing Smart SME articles you may link to (use these EXACT URLs, and only where genuinely relevant):
${links}${factBlock(post.id)}`;
}

function parse(raw) {
  let body = raw.trim();
  const out = {
    keyphrase: headerLine(body, "KEYPHRASE"),
    metaDesc: stripDashes(headerLine(body, "META_DESC")),
    imageQuery: headerLine(body, "IMAGE_QUERY"),
  };
  const start = body.indexOf("<");
  if (start > 0) body = body.slice(start).trim();
  out.body = stripDashes(body).replace(/```html?|```/g, "").trim();
  return out;
}

function mechanicalIssues({ body, keyphrase, metaDesc }, posts, selfId) {
  const issues = [];
  const m = metrics({ content: { rendered: body } });
  if (m.words < BENCH.words) issues.push(`Too short: ${m.words} words, want ${BENCH.words}+`);
  if (/[—–]/.test(body + (metaDesc || ""))) issues.push("Contains em or en dashes (house rule)");
  if (/<h1[\s>]/i.test(body)) issues.push("Contains an H1; the template prints the title");
  if (!keyphrase) issues.push("Missing focus keyphrase");
  if (!metaDesc) issues.push("Missing meta description");
  else if (metaDesc.length < 115 || metaDesc.length > 158) issues.push(`Meta description ${metaDesc.length} chars, want 120-155`);
  if (/lorem ipsum|\bTODO\b|\[insert|\[placeholder|XX%/i.test(body)) issues.push("Contains placeholder text");
  if (m.h2 < BENCH.h2) issues.push(`Only ${m.h2} H2 sections, want ${BENCH.h2}+`);
  if (!m.tables) issues.push("No comparison table");
  if (!m.faq) issues.push("No FAQ section");

  const known = knownUrlSet(posts.filter((p) => p.id !== selfId));
  const hrefs = [...body.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  const internal = hrefs.filter((h) => /smartsme\.co\.uk/i.test(h));
  const bad = internal.filter((h) => !known.has(h) && !known.has(h.replace(/\/$/, "")));
  if (bad.length) issues.push(`Invented or self-referential internal URLs: ${bad.slice(0, 3).join(", ")}`);
  if (internal.length - bad.length < BENCH.internal)
    issues.push(`Only ${internal.length - bad.length} valid internal links, want ${BENCH.internal}+`);
  const outbound = [...new Set(hrefs.filter((h) => /^https?:\/\//i.test(h) && !/smartsme\.co\.uk/i.test(h)))];
  if (outbound.length < 2) issues.push(`Only ${outbound.length} outbound link(s), want 2+`);

  // Any source we supplied facts from must actually be linked in the piece.
  // Citing a source in prose without linking it is not sourcing.
  const factsFile = path.join(__dirname, "enrich-facts.json");
  if (fs.existsSync(factsFile)) {
    const entry = JSON.parse(fs.readFileSync(factsFile, "utf8"))[String(selfId)];
    for (const src of entry?.sources || []) {
      if (!body.includes(src)) issues.push(`Supplied source is not linked in the article: ${src}`);
    }
  }
  return { issues, words: m.words, h2: m.h2 };
}

async function factCheck({ title, original, rewritten, postId }) {
  // Facts supplied from a verified primary source are sanctioned, so the gate
  // must not report them as inventions.
  let allowed = "";
  const file = path.join(__dirname, "enrich-facts.json");
  if (fs.existsSync(file)) {
    const entry = JSON.parse(fs.readFileSync(file, "utf8"))[String(postId)];
    if (entry)
      allowed = `\n\nSANCTIONED FACTS: the following were supplied to the writer from verified primary sources (${entry.sources.join(", ")}). Treat them, and correct restatements of them, as VERIFIED. Do NOT report them as fabrication. Do still flag any figure, date or threshold that goes beyond this list.\n${entry.facts.map((f) => `- ${f}`).join("\n")}`;
  }

  const out = await ask({
    maxTokens: 1600,
    system: `You are the editor of Smart SME Magazine checking an expanded rewrite against the original article.

Your ONE job is to catch fabrication. Flag anything in the rewrite that:
- States a statistic, percentage, survey finding, price, date, or quote that is NOT in the original.
- Attributes a claim to a named company, product or public body that the original does not support.
- Invents a customer, case study or example presented as real.
- Extends a described news event or announcement beyond what the original says happened.
- Gives tax, legal, employment or security advice that could harm a small business if wrong.

Generalised, qualitative statements and widely-known public facts are FINE. Approximate pricing
explicitly flagged as approximate is FINE. Do not flag stylistic choices or ask for more length.

Reply ONLY with JSON:
{"verdict":"publish"|"fix","issues":["specific, quoting the offending text"],"summary":"<one sentence>"}
Return an empty issues array when the rewrite invents nothing.`,
    user: `Headline: ${title}${allowed}\n\n=== ORIGINAL ===\n${original.slice(0, 12000)}\n\n=== REWRITE ===\n${rewritten.slice(0, 40000)}`,
  });
  const summary = field(out, "summary") || "";
  const verdict = (field(out, "verdict") || "").toLowerCase();
  const issues = [...out.matchAll(/"([^"]{20,300})"/g)].map((m) => m[1]).filter((s) => s !== summary && !/^(publish|fix)$/i.test(s));
  return { verdict, issues, summary };
}

/* ------------------------------------------------------------------- runner */

async function enrichOne(post, posts, usedImages, imagesOnly, archive, reimage = false) {
  const id = post.id;
  const title = clean(post.title.rendered);
  const before = metrics(post);
  const img = await mediaInfo(post.featured_media);
  const links = linkBlock(posts, id);
  const originalHtml = post.content.rendered;

  let result = { id, title, before, after: null, image: null };

  if (!imagesOnly) {
    log(`[${id}] rewriting "${title.slice(0, 50)}" (${before.words}w)`);
    let draft = parse(await ask({ system: HOUSE_STYLE, user: rewritePrompt(post, originalHtml, links) }));

    let mech = mechanicalIssues(draft, posts, id);
    let fact = await factCheck({ title, original: originalHtml, rewritten: draft.body, postId: id });
    let issues = [...mech.issues, ...(fact.verdict === "publish" ? [] : fact.issues)];

    if (issues.length) {
      log(`[${id}] QA round 1: ${mech.words}w, ${issues.length} issue(s)`);
      issues.forEach((i) => log(`   - ${i}`));
      const revised = parse(
        await ask({
          system: HOUSE_STYLE,
          user: `Below is a rewritten Smart SME article and the editor's fix list. Correct every point. Keep what already works, do not shorten, and do not drop valid internal links. Return the full corrected article in the standard output format.

EDITOR'S FIX LIST:
${issues.map((x, n) => `${n + 1}. ${x}`).join("\n")}

Internal links must come from this exact list only:
${links}

CURRENT DRAFT
KEYPHRASE: ${draft.keyphrase}
META_DESC: ${draft.metaDesc}

${draft.body}`,
        })
      );
      const nMech = mechanicalIssues(revised, posts, id);
      const nFact = await factCheck({ title, original: originalHtml, rewritten: revised.body, postId: id });
      const nIssues = [...nMech.issues, ...(nFact.verdict === "publish" ? [] : nFact.issues)];
      log(`[${id}] QA round 2: ${nMech.words}w, ${nIssues.length} issue(s)`);
      nIssues.forEach((i) => log(`   - ${i}`));
      if (nIssues.length <= issues.length) {
        draft = revised;
        mech = nMech;
        issues = nIssues;
      }
    }

    const blocking = issues.filter((i) => !/^Meta description /.test(i));
    if (blocking.length) {
      log(`[${id}] HELD BACK: ${blocking.length} unresolved`);
      fs.writeFileSync(path.join(__dirname, `held-${id}.html`), draft.body);
      return { ...result, status: "held", issues: blocking };
    }
    result.draft = draft;
    result.after = { words: mech.words, h2: mech.h2 };
  }

  // Replace the header image only when the current one is genuinely low
  // resolution; a good existing image is left alone. --reimage overrides that,
  // for a picture that is technically fine but wrong on the page — most often
  // a sibling frame of a shoot already running in the same section.
  let mediaId = null;
  if (reimage || img.width < BENCH.imageWidth) {
    log(`[${id}] image is ${img.width || "none"}px, sourcing replacement`);
    const picked = await chooseImage({
      title,
      keyphrase: result.draft?.keyphrase,
      brief: clean(post.excerpt?.rendered),
      used: usedImages,
      usedShoots: archive.shoots,
      nearby: archive.alts.get(archive.categoryOf.get(id)) || [],
    });
    if (picked) {
      usedImages.add(picked.url);
      if (picked.source) archive.shoots.add(picked.source);
      result.imageUrl = picked.url;
      result.imageSource = picked.source;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55);
      const up = await uploadMedia({ file: picked.file, alt: picked.alt, filename: `${slug}-hd` });
      mediaId = up.id;
      result.image = { from: img.width, to: `${up.width}x${up.height}`, score: picked.score };
      log(`[${id}] image ${img.width}px -> ${up.width}x${up.height} (media #${up.id})`);
    } else {
      log(`[${id}] no replacement image passed the picture gate, keeping existing`);
    }
  }

  if (!result.draft && !mediaId) return { ...result, status: "skipped" };

  await updatePost(id, {
    content: result.draft?.body,
    excerpt: result.draft?.metaDesc,
    keyphrase: result.draft?.keyphrase,
    metaDesc: result.draft?.metaDesc,
    featuredMediaId: mediaId,
  });
  log(`[${id}] UPDATED ${post.link}`);

  // Keep the app's record in step so Link Map and the never-repeat image rule
  // can see these posts.
  const existing = await prisma.article.findFirst({ where: { wpPostId: id } });
  const data = {
    title,
    status: "published",
    body: result.draft?.body || originalHtml,
    wpPostId: id,
    ...(result.draft ? { keyphrase: result.draft.keyphrase, metaDesc: result.draft.metaDesc } : {}),
    ...(result.imageUrl ? { imageUrl: result.imageUrl, imageSource: result.imageSource || null } : {}),
    publishedAt: new Date(post.date || Date.now()),
  };
  if (existing) await prisma.article.update({ where: { id: existing.id }, data });
  else await prisma.article.create({ data: { ...data, type: "seo_original", qaPassed: true } });

  return { ...result, status: "enriched", link: post.link };
}

(async () => {
  const args = process.argv.slice(2);
  const imagesOnly = args.includes("--images");
  // --reimage replaces the header picture on the named posts whatever its
  // resolution, for images that are technically fine but wrong on the page.
  // Deliberately requires explicit post IDs: it spends a vision call and
  // rewrites live media, so it must never sweep the archive by accident.
  const reimage = args.includes("--reimage");
  const only = args.filter((a) => /^\d+$/.test(a)).map(Number);
  if (reimage && !only.length) {
    log("--reimage needs one or more post IDs");
    process.exit(1);
  }
  // Re-run a post already marked enriched, e.g. after supplying verified facts.
  const force = args.includes("--force");
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};

  const posts = await livePosts();
  const history = await prisma.article.findMany({
    where: { imageUrl: { not: null } },
    select: { wpPostId: true, imageUrl: true, imageSource: true, imageAlt: true, category: true },
    orderBy: { createdAt: "desc" },
  });
  const usedImages = new Set(history.map((a) => a.imageUrl));
  // Shoots expire after forty articles; URLs never do. `alts` is art direction
  // rather than exclusion: the query writer is shown what its own section has
  // been running and told to go elsewhere.
  const archive = {
    shoots: new Set(history.slice(0, 40).map((a) => a.imageSource).filter(Boolean)),
    alts: history.reduce((map, a) => {
      if (!a.imageAlt) return map;
      const list = map.get(a.category) || [];
      if (list.length < 5) map.set(a.category, list.concat(a.imageAlt));
      return map;
    }, new Map()),
    categoryOf: new Map(history.filter((a) => a.wpPostId).map((a) => [a.wpPostId, a.category])),
  };

  // Work out what actually needs attention.
  const candidates = [];
  for (const p of posts) {
    const m = metrics(p);
    const img = await mediaInfo(p.featured_media);
    const thin = m.words < BENCH.words || m.h2 < BENCH.h2 || !m.tables || !m.faq || m.internal < BENCH.internal;
    const lowRes = img.width < BENCH.imageWidth;
    if (only.length ? only.includes(p.id) : thin || lowRes) candidates.push({ post: p, m, img, thin, lowRes });
  }
  candidates.sort((a, b) => a.m.words - b.m.words);

  log(`${posts.length} live posts | ${candidates.length} need work`);
  candidates.forEach((c) =>
    log(`   #${c.post.id} ${String(c.m.words).padStart(5)}w img=${c.img.width || "none"}px ${c.thin ? "THIN " : ""}${c.lowRes ? "LOWRES" : ""}  ${clean(c.post.title.rendered).slice(0, 45)}`)
  );

  const todo = force || reimage ? candidates : candidates.filter((c) => state[c.post.id]?.status !== "enriched");
  for (let i = 0; i < todo.length; i += 3) {
    const batch = todo.slice(i, i + 3);
    log(`\n=== BATCH ${Math.floor(i / 3) + 1}: ${batch.map((b) => b.post.id).join(", ")} ===`);
    const settled = await Promise.allSettled(
      batch.map((c) =>
        enrichOne(c.post, posts, usedImages, reimage || imagesOnly || (!c.thin && c.lowRes), archive, reimage)
      )
    );
    settled.forEach((r, n) => {
      const id = batch[n].post.id;
      state[id] = r.status === "fulfilled" ? r.value : { id, status: "error", error: r.reason?.message };
      if (r.status === "rejected") log(`[${id}] ERROR ${state[id].error}`);
    });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  }

  log("\n=== SUMMARY ===");
  Object.values(state).forEach((r) =>
    log(
      `${(r.status || "?").toUpperCase().padEnd(9)} #${String(r.id).padEnd(4)} ${
        r.before ? `${r.before.words}w -> ${r.after ? r.after.words + "w" : "unchanged"}` : ""
      } ${r.image ? `| img ${r.image.from}px -> ${r.image.to}` : ""} ${(r.issues || []).join("; ").slice(0, 90)}`
    )
  );
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
