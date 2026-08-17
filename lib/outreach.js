// The backlink engine.
//
// Every article we publish names companies. Each of those companies has a news
// page, a marketing team with a quota, and no idea they were written about. The
// engine closes that gap: it finds the mentions, works out who to tell, and
// writes them an email whose entire job is to make linking back the path of
// least resistance.
//
// The design assumption worth stating, because everything here follows from it:
// "please link to us" converts at a rate somewhere near zero, and "you were
// featured, here is the paragraph and the LinkedIn post already written for
// you" converts because it hands a marketing manager a finished win. So the
// row we build is mostly assets, and the email is mostly delivery.
//
// Two hard rules run through the file. Nothing is sent without JB approving it,
// and an opt-out is permanent. Neither is negotiable by any later caller.
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma, forSite } from "./prisma";
import { isUnreachable } from "./reachability";
import { isDraftingConfigured, stripEmDashes } from "./drafting";
import { fetchPost, isWordPressConfigured } from "./wordpress";
import { siteCredentials } from "./site";
import { titleBrief, siteUrl, siteHost } from "./voice";
import { sendGmail, isGmailConfigured, outreachSender, gmailSetupHint, repliedSince, bouncedSince } from "./gmail";

// Vercel kills a function at 60s, so every entry point here works in small
// bites and leaves the rest for the next tick. The engine is a slow drip by
// design anyway: outreach that arrives in bursts reads as a mailshot.
const MAX_ARTICLES_PER_RUN = 2;
const MAX_SENDS_PER_RUN = 5;
const MAX_LINK_CHECKS_PER_RUN = 40;

const LOOKBACK_DAYS = 14; // how far back to hunt for un-chased articles
const BRAND_COOLDOWN_DAYS = 45; // never contact the same brand more often
const FOLLOW_UP_AFTER_DAYS = 7; // one chase, then silence

// The host the Backlink Manager wins links for comes from the title.

// All three take the title's credential bundle — `creds` from getSiteContext or
// siteCredentials(). Composing is fleet-wide (one Anthropic key), resolving
// article URLs is per title, and so is the mailbox it sends from.
export function isOutreachConfigured(creds) {
  return isDraftingConfigured() && isWordPressConfigured(creds?.wordpress);
}

export function isSendConfigured(creds) {
  return isGmailConfigured(creds?.outreach);
}

export function outreachSetupHint(creds) {
  if (!isDraftingConfigured()) return "Needs ANTHROPIC_API_KEY to compose outreach.";
  if (!isWordPressConfigured(creds?.wordpress)) return "Needs WordPress credentials to resolve article URLs.";
  return gmailSetupHint(creds?.outreach);
}

// ---------- text ----------

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#822[01];/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ")
    // Stripping an inline tag leaves a space where the tag was, so "<b>Acme</b>,"
    // becomes "Acme ,". Harmless for matching, but the quote is copied verbatim
    // into an email to the company it names, so the artifact has to go.
    .replace(/[ \t]+([,.;:!?%)\]])/g, "$1")
    .replace(/([([])[ \t]+/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const squash = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

// A brand name only counts on a word boundary. Without it "Sage" matches
// "message" and the engine emails an accounting company about a story that
// never mentioned them.
function mentionsName(text, name) {
  if (!name || name.trim().length < 3) return false;
  return new RegExp(`\\b${escapeRe(name.trim())}\\b`, "i").test(text);
}

function hostOf(url) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ---------- opt-out ----------

// Signed so the link in an email cannot be used to opt out a brand that is not
// the one it was sent to, and so no database lookup is needed to validate it.
export function unsubscribeToken(brandId) {
  const secret = process.env.AUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(`unsub:${brandId}`).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(brandId, token) {
  if (!brandId || !token) return false;
  const expected = unsubscribeToken(brandId);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function unsubscribeUrl(brandId) {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!base || !brandId) return null;

  // A localhost APP_URL in a deployed environment is worse than no URL at all.
  // The email template renders a real <a href> whenever this returns anything,
  // so an unreachable base produces a DEAD "Unsubscribe" link in outreach mail —
  // and a broken opt-out is exactly the thing UK B2B direct marketing cannot
  // have. APP_URL was still http://localhost:3000 in the Vercel environment on
  // 17 August, with 83 emails already sent.
  //
  // Returning null instead makes the template fall through to its other branch,
  // "reply with no thanks and we will not contact you again", which is a real
  // working opt-out. Fix the variable and the link comes back on its own.
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(base)) {
    console.warn(
      `[outreach] APP_URL is "${base}", which is not reachable by a recipient. ` +
        `Falling back to reply-based opt-out. Set APP_URL to the deployed origin.`
    );
    return null;
  }

  return `${base}/api/unsubscribe?b=${encodeURIComponent(brandId)}&t=${unsubscribeToken(brandId)}`;
}

// ---------- contact resolution ----------

const CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/press", "/media", "/news"];
const PREFERRED = ["press", "media", "pr", "publicrelations", "comms", "communications", "marketing"];
const JUNK_DOMAINS = [
  "example.com", "sentry.io", "wixpress.com", "godaddy.com", "squarespace.com",
  // The domains that appear in a form's placeholder text rather than in a real
  // mailto. Two of these were emailed for real: "Beyond featured in our dynamic
  // pricing piece" went to you@company.com and the Mailchimp guide went to
  // name@company.com. Both bounced, both from a site whose contact page had no
  // actual address on it.
  "company.com", "yourcompany.com", "yourdomain.com", "domain.com", "email.com",
  "example.org", "example.net", "test.com", "acme.com", "mycompany.com",
];

// Local parts that are placeholder text wherever they appear. A contact page
// with no real address on it usually still contains one of these in an input's
// placeholder, and a regex pass cannot tell the difference by shape alone.
const PLACEHOLDER_LOCALPARTS = new Set([
  "you", "your", "youremail", "your-email", "yourname", "name", "yourname",
  "firstname", "lastname", "fullname", "email", "emailaddress", "address",
  "someone", "somebody", "user", "username", "example", "sample", "test",
  "johndoe", "janedoe", "john.doe", "jane.doe", "first.last", "abc", "xyz",
]);

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html") && !type.includes("text")) return null;
    return (await res.text()).slice(0, 400000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Deliberately a regex pass and nothing more. These pages are third-party HTML,
// which means anything on them is untrusted input, and the one thing we will
// never do with untrusted input is hand it to the model and act on what it says.
// Pulling addresses out with a pattern keeps the blast radius at "wrong email".
function harvestEmails(html, domain) {
  const found = new Set();
  const add = (raw) => {
    const email = String(raw || "").trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return;
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) return;
    if (JUNK_DOMAINS.some((d) => email.endsWith(`@${d}`) || email.endsWith(`.${d}`))) return;
    if (PLACEHOLDER_LOCALPARTS.has(email.split("@")[0].replace(/[._-]/g, ""))) return;
    found.add(email);
  };
  for (const m of html.matchAll(/mailto:([^"'\s>?]+)/gi)) add(m[1]);
  for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) add(m[0]);

  const list = [...found];
  // ON-DOMAIN ONLY. This used to fall back to every address on the page when
  // none matched the brand's own domain, which is precisely when a page has no
  // real contact on it — so the fallback reliably picked up whatever example or
  // third-party address happened to be in the markup. An address on someone
  // else's domain is not this brand's press contact, and having none is a
  // better answer than having the wrong one: the caller falls through to the
  // guessed address, which is gated on a human confirming it.
  const pool = domain
    ? list.filter((e) => e.endsWith(`@${domain}`) || e.endsWith(`.${domain}`))
    : [];
  if (!pool.length) return null;
  for (const prefix of PREFERRED) {
    const hit = pool.find((e) => e.split("@")[0].replace(/[.\-_]/g, "").startsWith(prefix));
    if (hit) return hit;
  }
  return pool.find((e) => /^(hello|enquiries|info|contact)@/.test(e)) || pool[0] || null;
}

// Returns { email, confidence } or null. "guessed" means we never saw the
// address written down anywhere, which is exactly the thing a human should
// glance at before the email goes out.
export async function resolveContact(site, website) {
  const domain = hostOf(website);
  if (!domain) return null;

  let candidate = null;
  for (const path of CONTACT_PATHS) {
    const html = await fetchText(`https://${domain}${path}`);
    if (!html) continue;
    const email = harvestEmails(html, domain);
    if (email) {
      candidate = { email, confidence: "found" };
      break;
    }
  }
  if (!candidate) candidate = { email: `press@${domain}`, confidence: "guessed" };

  return verifyContact(candidate);
}

/**
 * Put the candidate past MillionVerifier before it can reach a queue.
 *
 * "found" only ever meant "a string shaped like an email appeared on their
 * contact page", which is not the same as "a mailbox exists there" — and the
 * human gate only covered "guessed", so a scraped-but-dead address sailed
 * through it. A verified address needs no confirmation; a dead one should never
 * be drafted at all, because the cost of sending it is not a wasted email, it
 * is a hard bounce against the domain's sending reputation, which is the only
 * sending reputation this engine has.
 *
 * Unconfigured or failing verification is not fatal: it leaves the confidence
 * exactly as it was, so behaviour falls back to the human gate rather than
 * blocking outreach on a third-party API being up.
 */
async function verifyContact(candidate) {
  if (!process.env.MILLIONVERIFIER_API_KEY) return candidate;
  try {
    const { verifyEmail } = await import("./prospects");
    const { result } = await verifyEmail(candidate.email);
    // MillionVerifier's own vocabulary: ok / catch_all / unknown / disposable /
    // invalid. Only "invalid" is a definite non-existent mailbox.
    if (result === "invalid") return { ...candidate, confidence: "undeliverable", verified: result };
    if (result === "ok") return { ...candidate, confidence: "verified", verified: result };
    return { ...candidate, verified: result };
  } catch {
    return candidate;
  }
}

// ---------- composing ----------

const COMPOSE_SYSTEM = (site) => `${titleBrief(site)}

You are ${site?.authorName || "the editor"}, editor of this publication. You are writing the email yourself, in the first person, and it is signed off in your name. Never refer to yourself or to "the editor" in the third person: that is you.

${site?.name || "This publication"} has published an article that mentions one or more companies. Your job is to identify those companies and write, for each, an email telling them they were featured.

You are writing ONLY the opening of a short email: the greeting and one or two sentences saying what the article covered about them. Nothing else.

Everything after your text is fixed and already written: the request for a link, the headline and address, the instruction about the link wording, the sign-off and the footer. Do not write any of it. No request for a link, no mention of the article address, no closing line, no sign-off.

Your part must be UNDER 45 WORDS. A marketing manager should read it in five seconds and know exactly which piece of coverage this is about.

Respond with ONLY valid JSON (no code fences):
{
  "mentions": [
    {
      "brand": "<company name exactly as a person would write it>",
      "known": <true if it appeared in the supplied known-brands list, else false>,
      "website": "<best-known official domain, e.g. acme.co.uk, or null if unsure>",
      "substantive": <true if the article says something real about them; false for a passing name-drop in a list>,
      "quote": "<one sentence from the article, copied VERBATIM, in which the company appears>",
      "subject": "<email subject, max 60 chars, states the coverage plainly>",
      "body": "<greeting plus one or two sentences on what was covered, UNDER 45 WORDS, blank line between paragraphs. Start with 'Hi <first name or team>,'. Stop there: no link request, no URL, no closing line, no signature.>"
    }
  ]
}

Rules:
- Under 45 words. This is the rule most likely to be broken. Count them.
- Never ask for anything. The request is already written and follows your text.
- The article headline and link are printed directly beneath your text, so never write out the URL or say where to find the piece.
- The "quote" MUST be copied verbatim from the article text. Never paraphrase it, never invent one. If you cannot find the company in a real sentence, set substantive to false.
- Never invent facts, statistics, awards or claims about a company beyond what the article says.
- Only list companies genuinely written about. ${site?.name || "This publication"} itself, and any publication or platform named only as a source, are not mentions.
- substantive false for anything that is a bare name in a list: those get no email.
- Write like a working editor emailing a contact: direct, warm, short sentences, no marketing language, no "I hope this finds you well", no "I wanted to reach out", no closing pleasantries like "happy to answer questions".
- British English.
- House rule: never use em dashes or en dashes anywhere in your output. Use commas, colons or full stops.`;

function buildComposePrompt({ title, url, text, knownBrands }) {
  const known = knownBrands.length
    ? knownBrands.map((b) => `- ${b.name}${b.website ? ` (${b.website})` : ""}`).join("\n")
    : "(none matched from our list)";
  return `Article title: ${title}
Article URL: ${url}

Known brands from our database whose names appear in this text:
${known}

Also identify any other companies genuinely covered that are not on that list.

Article text:
"""
${text.slice(0, 9000)}
"""`;
}

// Sonnet. These are short outreach emails written to a fixed template against
// a brand we already know, and every one of them waits in a queue for JB to
// approve before it is sent. Nothing here reaches a recipient on the model's
// own judgement.
const COMPOSE_MODEL = "claude-sonnet-5";

async function composeMentions(site, input) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: COMPOSE_MODEL,
    max_tokens: 4000,
    system: COMPOSE_SYSTEM(site),
    messages: [{ role: "user", content: buildComposePrompt(input) }],
  });
  try {
    (await import("./agents/meter")).recordUsage(response.model || COMPOSE_MODEL, response.usage);
  } catch {}

  if (response.stop_reason === "refusal") throw new Error("outreach composition refused");
  let text = "";
  for (const block of response.content) if (block.type === "text") text += block.text;
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!json) throw new Error("no JSON in outreach response");
  const parsed = JSON.parse(json);
  return Array.isArray(parsed.mentions) ? parsed.mentions : [];
}

// ---------- generation ----------

// Takes the scoped handle rather than closing over one. It used to read a
// module-level `db` that no longer exists after the multi-tenant split, so
// every call was a ReferenceError the moment an article was too short to scan.
const markScanned = (db, articleId) =>
  db.article.update({ where: { id: articleId }, data: { outreachScannedAt: new Date() } });

export async function runBacklinkOutreach(site, creds) {
  const db = forSite(site.id);
  if (!creds) ({ creds } = await siteCredentials(site.id));
  if (!isOutreachConfigured(creds)) throw new Error("outreach engine not configured");

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const articles = await db.article.findMany({
    where: {
      status: "published",
      wpPostId: { not: null },
      publishedAt: { gte: cutoff },
      outreachScannedAt: null,
    },
    orderBy: { publishedAt: "desc" },
    take: MAX_ARTICLES_PER_RUN,
  });
  if (articles.length === 0) return { scanned: 0, created: 0 };

  const brands = await db.prBrand.findMany();
  const coolOff = new Date(Date.now() - BRAND_COOLDOWN_DAYS * 86400000);
  let created = 0;
  const skipped = [];

  for (const article of articles) {
    const text = htmlToText(article.body);
    if (text.length < 200) {
      await markScanned(db, article.id);
      continue;
    }

    let url = null;
    let title = article.title;
    try {
      const post = await fetchPost(creds.wordpress, article.wpPostId);
      url = post.link;
      title = htmlToText(post.title?.rendered) || title;
    } catch {
      // No live URL means no email worth sending. Leave the article alone and
      // let the next tick retry rather than writing a row that points nowhere.
      continue;
    }

    const knownBrands = brands.filter((b) => mentionsName(text, b.name));
    let mentions = [];
    try {
      mentions = await composeMentions(site, { title, url, text, knownBrands });
    } catch (e) {
      skipped.push({ article: article.id, error: e.message });
      continue;
    }

    for (const m of mentions) {
      if (!m?.brand || m.substantive === false) continue;

      // The model is not trusted on the one field that has to be real. If the
      // quote is not in the article word for word, the mention is dropped: a
      // fabricated quote sent to the company it is about would be unrecoverable.
      const quote = String(m.quote || "");
      if (!quote || !squash(text).includes(squash(quote))) {
        skipped.push({ brand: m.brand, reason: "quote not found verbatim in article" });
        continue;
      }

      let brand = brands.find((b) => squash(b.name) === squash(m.brand));
      if (!brand) {
        brand = await db.prBrand.create({
          data: {
            name: String(m.brand).slice(0, 120),
            website: m.website ? `https://${hostOf(m.website) || m.website}` : null,
            category: "mentioned",
            notes: `Added by the backlink engine from "${title}".`,
          },
        });
        brands.push(brand);
      }

      if (brand.optedOut) {
        skipped.push({ brand: brand.name, reason: "opted out" });
        continue;
      }

      // Checked before the contact lookup, so a household name does not even
      // cost us a page fetch to find a press address nobody will read.
      if (isUnreachable(brand.name)) {
        skipped.push({ brand: brand.name, reason: "too large to answer, not emailed" });
        continue;
      }

      const recent = await db.outreachEmail.findFirst({
        where: { brandId: brand.id, createdAt: { gte: coolOff } },
      });
      if (recent) {
        skipped.push({ brand: brand.name, reason: `contacted within ${BRAND_COOLDOWN_DAYS} days` });
        continue;
      }

      // Resolve a press address once per brand and keep it. Brands recur.
      if (!brand.prContactEmail && (brand.website || m.website)) {
        // Was resolveContact(website) — one argument into a two-argument
        // signature, so `site` was the website string and forSite(undefined)
        // threw on every brand whose address was not already on file. Exactly
        // the fault sendOutreachEmail(row.id) had, in the same file.
        const contact = await resolveContact(site, brand.website || m.website);
        if (contact) {
          brand = await db.prBrand.update({
            where: { id: brand.id },
            data: {
              prContactEmail: contact.email,
              contactConfidence: contact.confidence,
              contactCheckedAt: new Date(),
              website: brand.website || (hostOf(m.website) ? `https://${hostOf(m.website)}` : null),
            },
          });
        }
      }

      // Drafting costs a model call. Spending one to write an email to a mailbox
      // verification has already said does not exist is money burnt to produce a
      // row that can only ever be refused at the send gate.
      if (brand.contactConfidence === "undeliverable") continue;

      await db.outreachEmail.create({
        data: {
          brandId: brand.id,
          brandName: brand.name,
          contactEmail: brand.prContactEmail || null,
          contactName: brand.prContactName || null,
          articleId: article.id,
          wpPostId: article.wpPostId,
          articleUrl: url,
          articleTitle: title,
          mentionQuote: stripEmDashes(quote),
          subject: stripEmDashes(String(m.subject || `${site.name} has covered ${brand.name}`)).slice(0, 160),
          body: stripEmDashes(String(m.body || "")),
        },
      });
      created += 1;
    }

    await markScanned(db, article.id);
  }

  return { scanned: articles.length, created, skipped };
}

// ---------- rendering ----------

export function logoUrl() {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return base ? `${base}/api/brand/logo` : null;
}

// The exact words we want the link on. Fixed rather than model-written, so the
// anchor text is identical in every email and identical everywhere it lands.
export const anchorText = (site) => `As seen on ${site?.name || "our site"}`;

// The ask and the close are fixed too, for the same reason the anchor is: these
// are the two sentences that decide whether the email works, so they are JB's
// words verbatim rather than something regenerated per email. The model only
// writes the opening context above them.
export const LINK_REQUEST =
  "We'd appreciate a link to this article from your news page, to help the article reach a wider audience.";

export const CLOSING =
  "Do keep sending your news our way. We cover this sector continuously, and we'll continue covering your news once the link is live.";

function signOff(site, brand, outreach) {
  const sender = outreachSender(outreach);
  const name = sender?.name || "James Burke";
  // Falls back to the publisher rather than to nothing. An outreach email with
  // no identifiable sender in the footer is the one thing here that is not just
  // untidy but non-compliant, so a missing credential must not be able to
  // produce one. The title's own postal address takes precedence when set.
  const address = outreach?.postalAddress || "Cogent Multimedia Ltd, United Kingdom";
  const unsub = unsubscribeUrl(brand?.id);
  return {
    name,
    address,
    unsub,
    reason: `You are getting this because ${site?.name || "we"} published an article about ${brand?.name || "your company"}.`,
  };
}

export function renderOutreach(site, row, brand, { followUp = false, outreach = null } = {}) {
  const ANCHOR_TEXT = anchorText(site);
  const s = signOff(site, brand, outreach);
  const logo = logoUrl();

  const bodyText = followUp
    ? `Hi${row.contactName ? ` ${row.contactName.split(" ")[0]}` : ""},\n\n` +
      `Just following up on our piece about ${row.brandName}. If it is not one for you, no problem, and I will leave it there.`
    : String(row.body || "");

  const text = [
    bodyText,
    LINK_REQUEST,
    `${row.articleTitle}\n${row.articleUrl}`,
    `Link the words "${ANCHOR_TEXT}" to that address.`,
    CLOSING,
    `${s.name}\nEditor, ${site?.name || ""}\n${siteUrl(site) || ""}`,
    s.address,
    s.reason,
    s.unsub ? `Prefer not to hear from us? ${s.unsub}` : `Reply with "no thanks" and we will not contact you again.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  // No badge image and no markup to paste. The ask is one line of plain English:
  // these words, that address. Anyone who can edit a page can do it.
  const askBox = `
    <div style="border-left:3px solid #2642e0;padding:2px 0 2px 14px;margin:0 0 18px">
      <p style="margin:0 0 6px;font-size:14px;color:#444">Link the words <strong style="color:#111">${escapeHtml(ANCHOR_TEXT)}</strong> to:</p>
      <a href="${row.articleUrl}" style="color:#2642e0;font-size:13px;word-break:break-all">${escapeHtml(row.articleUrl || "")}</a>
    </div>`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">
    ${paragraphs}
    <p style="margin:0 0 14px">${escapeHtml(LINK_REQUEST)}</p>
    <p style="margin:0 0 14px"><a href="${row.articleUrl}" style="color:#2642e0">${escapeHtml(row.articleTitle || "Read the article")}</a></p>
    ${askBox}
    <p style="margin:0 0 18px">${escapeHtml(CLOSING)}</p>
    <p style="margin:0 0 16px">${escapeHtml(s.name)}<br><span style="color:#6b7280">Editor, ${escapeHtml(site?.name || "")}</span></p>
    <hr style="border:none;border-top:1px solid #e2e5ee;margin:0 0 12px">
    ${
      logo
        ? `<p style="margin:0 0 8px"><a href="${siteUrl(site) || "#"}"><img src="${logo}" alt="${escapeHtml(site?.name || "")}" height="22" style="height:22px"></a></p>`
        : ""
    }
    <p style="margin:0;font-size:11px;line-height:1.5;color:#8b93a3">
      ${s.address ? `${escapeHtml(s.address)}<br>` : ""}
      ${escapeHtml(s.reason)}<br>
      ${
        s.unsub
          ? `<a href="${s.unsub}" style="color:#8b93a3">Unsubscribe</a>`
          : `Reply with "no thanks" and we will not contact you again.`
      }
    </p>
  </div>`;

  const subject = followUp ? `Re: ${row.subject}` : row.subject;
  return { subject, text, html };
}

// ---------- sending ----------

// Every refusal below writes its reason to the row before throwing. Without
// that the approve button leaves the row sitting on "approved" for ever with
// nothing on screen to say why, because its caller swallows the throw.
// Takes the scoped handle. `db` was unbound here, so every refusal threw
// "db is not defined" instead of its real reason. The refusals themselves still
// held — they short-circuit before anything is sent, so an opt-out was never
// breached — but the row never recorded why, and the queue showed a database
// error where it should have said "Sage has opted out".
async function refuse(db, row, message, followUp) {
  await db.outreachEmail.update({
    where: { id: row.id },
    data: followUp
      ? // The first email did go out, so the row keeps its status: what failed
        // is the chase. Retiring the chase rather than leaving it due stops the
        // same refusal being retried on every tick from here on.
        { error: message, followUpSentAt: new Date() }
      : { status: "failed", error: message },
  });
  throw new Error(message);
}

// The single send path. Everything that puts mail on the wire goes through
// here, so the opt-out check and the footer cannot be skipped by a caller.
export async function sendOutreachEmail(site, id, { followUp = false, creds = null } = {}) {
  const db = forSite(site.id);
  if (!creds) ({ creds } = await siteCredentials(site.id));
  const row = await db.outreachEmail.findUnique({ where: { id }, include: { brand: true } });
  if (!row) throw new Error("outreach email not found");
  if (!row.contactEmail) return refuse(db, row, "No contact address on this row.", followUp);
  if (row.brand?.optedOut) return refuse(db, row, `${row.brandName} has opted out.`, followUp);

  // Also checked when the draft is written, which saves the page fetch, but only
  // the check here catches a row drafted before a name reached the list. Three
  // days of queue predate the list, which is how Microsoft and HubSpot were
  // emailed a week after the rule that should have stopped them.
  if (isUnreachable(row.brandName)) {
    return refuse(db, row, `${row.brandName} is too large to answer press outreach. Not sent.`, followUp);
  }

  // Verification said this mailbox does not exist. Refuse on every path,
  // including a chase and including an address a human ticked off: a hard bounce
  // costs sending reputation, and no amount of human confidence conjures a
  // mailbox into being. The fix is a different address, not a retry.
  if (row.brand?.contactConfidence === "undeliverable") {
    return refuse(
      db,
      row,
      `${row.contactEmail} was checked and does not exist. Find the real press address and replace it — sending anyway costs domain reputation.`,
      followUp
    );
  }

  // A guessed address is press@ plus their domain and nothing else: nobody ever
  // saw it written down anywhere. Sending to one is what produced a morning of
  // hard bounces, so it needs a human to confirm or replace it first. A chase is
  // exempt because that address has already accepted a message, and a hard
  // bounce would have moved the row to "bounced" long before the chase is due.
  if (
    !followUp &&
    row.brand?.contactConfidence === "guessed" &&
    row.contactEmail === row.brand?.prContactEmail
  ) {
    return refuse(
      db,
      row,
      `${row.contactEmail} was guessed from their domain, not found on their site. Confirm or replace it before sending.`,
      followUp
    );
  }

  if (!isSendConfigured(creds)) {
    return refuse(db, row, gmailSetupHint(creds?.outreach) || "Sending is not configured.", followUp);
  }

  const { subject, text, html } = renderOutreach(site, row, row.brand, { followUp, outreach: creds.outreach });
  try {
    await sendGmail({
      outreach: creds.outreach,
      to: row.contactEmail,
      toName: row.contactName,
      subject,
      text,
      html,
      unsubscribeUrl: unsubscribeUrl(row.brandId),
    });
  } catch (e) {
    await db.outreachEmail.update({
      where: { id },
      data: { status: "failed", error: e.message, attempts: { increment: 1 } },
    });
    throw e;
  }

  return db.outreachEmail.update({
    where: { id },
    data: {
      status: "sent",
      error: null,
      attempts: { increment: 1 },
      ...(followUp ? { followUpSentAt: new Date() } : { sentAt: new Date() }),
    },
  });
}

// Approved rows that have not gone yet, plus the one chase each row is allowed.
export async function runOutreachSends(site, creds) {
  const db = forSite(site.id);
  if (!creds) ({ creds } = await siteCredentials(site.id));
  if (!isSendConfigured(creds)) return { skipped: gmailSetupHint(creds?.outreach) };

  const approved = await db.outreachEmail.findMany({
    where: { status: "approved", contactEmail: { not: null } },
    orderBy: { createdAt: "asc" },
    take: MAX_SENDS_PER_RUN,
  });

  let sent = 0;
  const failures = [];
  for (const row of approved) {
    try {
      // Was sendOutreachEmail(row.id) — one argument into a three-argument
      // signature, so `site` was the row id and every scheduled send threw
      // before it reached the opt-out check.
      await sendOutreachEmail(site, row.id, { creds });
      sent += 1;
    } catch (e) {
      failures.push({ id: row.id, brand: row.brandName, error: e.message });
    }
  }

  const chaseCutoff = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 86400000);
  const chases = await db.outreachEmail.findMany({
    where: {
      status: "sent",
      sentAt: { lte: chaseCutoff },
      followUpSentAt: null,
      linkedAt: null,
      contactEmail: { not: null },
    },
    take: MAX_SENDS_PER_RUN,
  });

  let chased = 0;
  for (const row of chases) {
    try {
      // Same one-argument fault as the first send loop above, which was found
      // and fixed there and missed here: the chase is a separate call site.
      await sendOutreachEmail(site, row.id, { followUp: true, creds });
      chased += 1;
    } catch (e) {
      failures.push({ id: row.id, brand: row.brandName, error: e.message });
    }
  }

  return { sent, chased, failures };
}

// ---------- did it work ----------

// Look for our link on the brand's own site. Their news hub if we know it,
// otherwise the homepage, which is where a small company puts its news anyway.
// Where a company actually puts a press mention. The homepage alone was the
// whole check, and it is the one page a link is least likely to be on: coverage
// lands on a blog post or a news index, not above the fold of the front page.
// The Lodgify reply on 14 August said the link would go "in a related blog",
// which the old check could never have found.
const LINK_PATHS = ["", "/blog", "/news", "/press", "/newsroom", "/media"];

// Wall clock, not a page count. Each brand is up to six fetches and the agent
// turn has to finish, so the sweep stops when it runs out of time and picks up
// where it left off next run — rows are taken oldest-first, so nothing starves.
const LINK_CHECK_BUDGET_MS = 40000;

/**
 * Is there a real link to us on this page?
 *
 * An href, not a mention. `html.includes(host)` matched our name written in
 * plain text, a rel=canonical, even our own domain inside a comment — none of
 * which is a backlink, and each of which would have marked the row won and
 * stopped anyone chasing the real thing.
 */
function linksTo(html, host) {
  return new RegExp(`href=["'][^"']*${escapeRe(host)}`, "i").test(html);
}

export async function runBacklinkCheck(site) {
  const db = forSite(site.id);
  const rows = await db.outreachEmail.findMany({
    where: { status: "sent", linkedAt: null },
    include: { brand: true },
    orderBy: { sentAt: "asc" },
    take: MAX_LINK_CHECKS_PER_RUN,
  });

  // The link we are looking for points at THIS title. Checked against a
  // hardcoded host, a second magazine would never register a single win — every
  // brand that linked it would still read as "waiting on a reply".
  const host = siteHost(site);
  if (!host) return { checked: 0, linked: 0, why: "no domain set for this title" };

  const deadline = Date.now() + LINK_CHECK_BUDGET_MS;
  let linked = 0;
  let checked = 0;
  const found = [];

  for (const row of rows) {
    if (Date.now() > deadline) break;
    const base = row.brand?.website || row.brand?.newsHubUrl;
    if (!base) continue;
    checked += 1;

    // The news hub first when we know it, then the usual places. Deduped
    // because a news hub is often just /blog under another name.
    let root;
    try {
      root = new URL(base).origin;
    } catch {
      continue;
    }
    const candidates = [...new Set([row.brand?.newsHubUrl, ...LINK_PATHS.map((p) => root + p)].filter(Boolean))];

    // Fetched together: six sequential 8-second timeouts is 48 seconds on a
    // dead host, which would spend the whole budget on one brand.
    const pages = await Promise.all(
      candidates.map(async (url) => ({ url, html: await fetchText(url, 6000) }))
    );
    const hit = pages.find((p) => p.html && linksTo(p.html, host));
    if (!hit) continue;

    await db.outreachEmail.update({
      where: { id: row.id },
      // The page the link is ON, not the page we happened to look at first —
      // otherwise "links won" is a number nobody can audit.
      data: { status: "linked", linkedAt: new Date(), linkUrl: hit.url },
    });
    linked += 1;
    found.push(`${row.brandName} (${hit.url})`);
  }
  return { checked, linked, found, ranOutOfTime: Date.now() > deadline };
}

// Which of them never arrived.
//
// Runs before the reply and link checks, because both of those ask a question
// about a brand that is only worth asking if the email reached them at all.
export async function runBounceCheck(site, creds) {
  const db = forSite(site.id);
  if (!creds) ({ creds } = await siteCredentials(site.id));
  const rows = await db.outreachEmail.findMany({
    where: { status: "sent", contactEmail: { not: null } },
    orderBy: { sentAt: "asc" },
    take: MAX_LINK_CHECKS_PER_RUN * 2,
  });
  if (!rows.length) return { checked: 0, bounced: [], available: true };

  const oldest = rows.reduce((acc, r) => (r.sentAt && r.sentAt < acc ? r.sentAt : acc), rows[0].sentAt || new Date());
  const { available, addresses } = await bouncedSince(creds?.outreach, oldest);
  if (!available) return { checked: 0, bounced: [], available: false };

  const bounced = [];
  for (const row of rows) {
    const diagnostic = addresses.get(String(row.contactEmail).toLowerCase());
    if (!diagnostic) continue;

    await db.outreachEmail.update({
      where: { id: row.id },
      data: { status: "bounced", error: `Bounced: ${diagnostic}` },
    });

    // The address is dead for the brand, not just for this one email. Clearing
    // it is what makes the next article re-resolve rather than inherit a known
    // bad address and bounce all over again. Guarded on the address still being
    // the one that failed, so a correction typed in since is not undone.
    if (row.brandId) {
      await db.prBrand.updateMany({
        where: { id: row.brandId, prContactEmail: row.contactEmail },
        data: { prContactEmail: null, contactConfidence: null, contactCheckedAt: new Date() },
      });
    }
    bounced.push(row.brandName);
  }
  return { checked: rows.length, bounced, available: true };
}

// Who has written back. Returns available:false when read access has not been
// delegated, so the caller can say "I cannot see the inbox" rather than
// reporting a confident zero.
export async function runReplyCheck(site, creds) {
  const db = forSite(site.id);
  if (!creds) ({ creds } = await siteCredentials(site.id));
  const rows = await db.outreachEmail.findMany({
    where: { status: "sent", sentAt: { not: null }, contactEmail: { not: null } },
    orderBy: { sentAt: "desc" },
    take: MAX_LINK_CHECKS_PER_RUN,
  });

  const replied = [];
  for (const row of rows) {
    const hit = await repliedSince(creds?.outreach, row.contactEmail, row.sentAt);
    if (hit === null) return { checked: 0, replied, available: false };
    if (!hit) continue;
    await db.outreachEmail.update({ where: { id: row.id }, data: { status: "replied" } });
    replied.push(row.brandName);
  }
  return { checked: rows.length, replied, available: true };
}

// ---------- pacing ----------

// The Cloudflare worker fires the whole engine on every tick, which is right for
// publishing and wrong for anything that hits other people's servers. Checking a
// brand's news page every fifteen minutes to see if they have linked us yet is
// how you end up in their WAF.
export async function dueToRun(site, key, minHours) {
  const db = forSite(site.id);
  const setting = await db.engineSetting.findUnique({ where: { key } });
  if (setting && Date.now() - Number(setting.value) < minHours * 3600000) return false;
  const value = String(Date.now());
  await db.engineSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  return true;
}

// ---------- stats ----------

export async function outreachStats(siteId) {
  const db = forSite(siteId);
  const rows = await db.outreachEmail.groupBy({ by: ["status"], _count: { _all: true } });
  const by = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  // A bounce reached nobody, so it is deliberately absent from `sent`. Counting
  // it was inflating the denominator under the one number the engine exists to
  // move, and padding "waiting on a reply" with brands who never got the email.
  const sent = (by.sent || 0) + (by.linked || 0) + (by.replied || 0);
  return {
    pending: by.pending || 0,
    approved: by.approved || 0,
    sent,
    linked: by.linked || 0,
    failed: by.failed || 0,
    bounced: by.bounced || 0,
    // Only meaningful once a handful have gone out, but it is the number the
    // whole engine exists to move.
    linkRate: sent ? Math.round(((by.linked || 0) / sent) * 100) : null,
  };
}
