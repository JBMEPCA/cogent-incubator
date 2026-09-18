/**
 * The Monday briefing: four stories, two minutes, one per title.
 *
 * Thursday is the full weekly issue (lib/newsletter-template.js). Monday is the
 * short one: a featured story, then the three articles readers read most last
 * week. Nothing in the email is long enough to replace the article, because the
 * job of this issue is the visit.
 *
 * Built on the same email rules as Thursday and reusing its helpers, so the two
 * cannot drift on tagging, entity decoding or the em dash rule: table layout,
 * inline styles, vertical space as spacer rows, never padding on a div.
 *
 * Every title gets its OWN palette, face and masthead from BRIEFING_TITLES.
 * Thursday's shell reads Smart SME's BRAND constants for every title (it
 * computes the title's accent and never uses it), which is exactly the drift
 * this table exists to prevent here.
 */

import { BRAND, CAT_COLOR, strip, noEmDash, tagged } from "./newsletter-template";

// Palettes lifted from each child theme's theme.json. Fleet is the exception:
// its masthead moved to motorway blue on 14 Sep 2026 and theme.json (petrol
// teal) has not caught up, so the email follows the mark rather than the site.
export const BRIEFING_TITLES = {
  "smart-sme": {
    name: "The Monday Memo",
    emoji: "📝",
    font: "Space Grotesk",
    colors: BRAND,
    catColors: CAT_COLOR,
    logoWidth: 160,
    uk: true,
  },
  "fleet-magazine": {
    name: "The Monday Dispatch",
    emoji: "🚚",
    font: "Archivo",
    colors: { brand: "#1D5FAA", ink: "#0F1519", surface: "#F2F5F6", line: "#DDE4E7", muted: "#55666D", mutedLight: "#9BADB4", white: "#FFFFFF" },
    logoWidth: 150,
    uk: true,
  },
  "golf-resort-magazine": {
    name: "The Monday Tee-Up",
    emoji: "⛳",
    font: "Archivo",
    colors: { brand: "#15694A", ink: "#0E1512", surface: "#F2F7F2", line: "#E1EBE3", muted: "#5A6E62", mutedLight: "#93A99A", white: "#FFFFFF" },
    logoWidth: 210,
    uk: false,
  },
  "airport-business-magazine": {
    name: "The Monday Check-In",
    emoji: "🛫",
    font: "Archivo",
    colors: { brand: "#123B66", ink: "#0D1321", surface: "#F3F5F8", line: "#DCE2EA", muted: "#566274", mutedLight: "#9AA7B8", white: "#FFFFFF" },
    logoWidth: 150,
    uk: false,
  },
  "barbering-business": {
    name: "The Monday Lineup",
    emoji: "💈",
    font: "Archivo",
    colors: { brand: "#6E2B2B", ink: "#171310", surface: "#F7F4EE", line: "#E5DFD3", muted: "#6A6156", mutedLight: "#A99F90", white: "#FFFFFF" },
    logoWidth: 240,
    uk: true,
  },
};

// Kept for callers that only need the name and emoji.
export const BRIEFING_NAMES = Object.fromEntries(
  Object.entries(BRIEFING_TITLES).map(([slug, t]) => [slug, { name: t.name, emoji: t.emoji }])
);

export const briefingCampaignId = (date = new Date()) => `monday-${date.toISOString().slice(0, 10)}`;

const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,:;]$/, "") + "...");
const clean = (s, n) => esc(noEmDash(n ? clip(strip(s), n) : strip(s)));

/**
 * The scannable half of a "Hook: explainer" headline. The house format puts the
 * news before the colon, and a list of three reads faster without the explainer.
 * Falls back to the whole headline when the hook alone would say too little.
 */
export function shortHeadline(title) {
  const t = noEmDash(strip(title));
  const i = t.indexOf(": ");
  if (i < 0) return t;
  const hook = t.slice(0, i);
  return hook.split(/\s+/).length >= 5 ? hook : t;
}

const spacer = (px) =>
  `<tr><td height="${px}" style="height:${px}px;font-size:0;line-height:${px}px;">&nbsp;</td></tr>`;

/** Everything a block needs to draw in one title's colours. */
function themeFor(slug) {
  const t = BRIEFING_TITLES[slug] || { ...BRIEFING_TITLES["smart-sme"], name: "The Week Ahead", emoji: "" };
  const C = t.colors;
  const SANS = `'${t.font}', Arial, Helvetica, sans-serif`;
  return {
    ...t,
    C,
    SANS,
    label: (text) =>
      `<span style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.brand};">${esc(text)}</span>`,
    kicker: (cat) =>
      `<span style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${
        t.catColors?.[cat] ?? C.brand
      };">${esc(cat)}</span>`,
    button: (href, text) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td align="center" bgcolor="${C.brand}" style="border-radius:8px;padding:13px 24px;mso-padding-alt:13px 24px;">
      <a href="${href}" style="display:block;font-family:${SANS};font-size:15px;font-weight:700;line-height:1;color:${C.white};text-decoration:none;white-space:nowrap;">${text}</a>
    </td>
  </tr>
</table>`,
  };
}

// ---- the two blocks ----

function renderLead(s, { campaign, T }) {
  const { C, SANS } = T;
  const href = esc(tagged(s.link, { campaign, content: "featured" }));
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 0 14px 0;">${T.label("Featured news")}</td></tr>
  <tr>
    <td style="padding:0 0 18px 0;">
      <a href="${href}" style="text-decoration:none;display:block;">
        <img src="${esc(s.imageLead)}" width="536" alt="${clean(s.title)}"
          style="display:block;width:100%;max-width:536px;height:auto;border:0;outline:none;border-radius:10px;" />
      </a>
    </td>
  </tr>
  <tr><td style="padding:0 0 8px 0;">${T.kicker(s.category)}</td></tr>
  <tr>
    <td style="padding:0 0 10px 0;">
      <a href="${href}" style="text-decoration:none;color:${C.ink};">
        <span class="mm-lead-h" style="font-family:${SANS};font-size:25px;line-height:1.22;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${clean(s.title)}</span>
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 20px 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${C.muted};">${clean(s.excerpt)}</td>
  </tr>
  <tr><td>${T.button(href, "Read the full story &rsaquo;")}</td></tr>
</table>`;
}

function renderMostRead(stories, { campaign, T }) {
  const { C, SANS } = T;
  const rows = stories
    .map((s, i) => {
      const href = esc(tagged(s.link, { campaign, content: `most-read-${i + 1}` }));
      return `
  <tr>
    <td style="padding:18px 0;${i ? `border-top:1px solid ${C.line};` : ""}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td class="mm-num" width="40" valign="top" style="width:40px;padding:0;font-family:${SANS};font-size:28px;line-height:1;font-weight:700;color:${C.brand};">${i + 1}</td>
          <td valign="top" style="padding:0 16px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr><td style="padding:0 0 5px 0;">${T.kicker(s.category)}</td></tr>
              <tr>
                <td style="padding:0;">
                  <a href="${href}" style="text-decoration:none;color:${C.ink};">
                    <span style="font-family:${SANS};font-size:17px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">${esc(shortHeadline(s.title))}</span>
                  </a>
                </td>
              </tr>
              <tr>
                <td class="mm-dek" style="padding:6px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.muted};">${clean(s.excerpt, 105)}</td>
              </tr>
            </table>
          </td>
          <td class="mm-thumb" width="92" valign="top" style="width:92px;padding:0;">
            <a href="${href}" style="text-decoration:none;display:block;">
              <img src="${esc(s.imageSquare || s.imageThumb)}" width="92" height="92" alt=""
                style="display:block;width:92px;height:92px;object-fit:cover;border:0;outline:none;border-radius:8px;" />
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
    })
    .join("");

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 0 2px 0;">${T.label("Last week's most read")}</td></tr>
  ${rows}
</table>`;
}

// ---- the whole email ----

/**
 * `thursday` says whether this title also sends the weekly issue. A title with
 * no Thursday send must not promise one, so the closing block changes with it.
 */
export function renderBriefing({ site, issueDate, logoUrl, logoWidth = null, campaign, lead, mostRead, previewText = "", thursday = true, proof = null }) {
  const T = themeFor(site?.slug);
  const { C, SANS } = T;
  const NAME = site?.name || "";
  const HOME = `https://${String(site?.domain || "").replace(/^https?:\/\//, "")}`;
  const home = (content) => esc(tagged(HOME, { campaign, content }));
  const footerLink = (p, text) =>
    `<a href="${esc(tagged(`${HOME}${p}`, { campaign, content: "footer" }))}" style="color:${C.mutedLight};text-decoration:none;">${text}</a>`;
  const fontHref = `https://fonts.googleapis.com/css2?family=${T.font.replace(/ /g, "+")}:wght@400;500;700&display=swap`;

  const closingHead = thursday ? `The full ${esc(NAME)} weekly lands on Thursday` : `New from ${esc(NAME)} every day`;
  const closingBody = thursday
    ? "Ten stories picked for your business. In the meantime, there is new reporting on the site every day."
    : "News, guides and comparisons for your business, published every morning.";

  // Proof only: what the reader sees in the inbox before they open anything.
  // Never part of a real send; renderBriefing without `proof` omits it.
  const proofBar = proof
    ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#E9EBF3;">
  <tr><td align="center" style="padding:22px 16px 18px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="mm-wrap" style="width:600px;max-width:600px;border-collapse:collapse;">
      <tr><td style="padding:0 0 8px 2px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#5A5E75;">Proof &middot; how it lands in the inbox</td></tr>
      <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:10px;padding:14px 18px;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:14px;font-weight:700;color:#0A0C16;">${esc(proof.fromName)} <span style="float:right;font-weight:400;font-size:12px;color:#5A5E75;">${esc(proof.time)}</span></div>
        <div style="font-size:14px;font-weight:700;color:#0A0C16;margin-top:3px;">${esc(proof.subject)}</div>
        <div style="font-size:13px;color:#5A5E75;margin-top:3px;">${esc(previewText)}</div>
        ${proof.note ? `<div style="font-size:12px;color:#A32633;margin-top:8px;">${esc(proof.note)}</div>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>`
    : "";

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(T.name)} | ${esc(NAME)}</title>
<!--[if !mso]><!-->
<link href="${fontHref}" rel="stylesheet" />
<!--<![endif]-->
<!--[if mso]>
<style>* { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
  @media only screen and (max-width:520px) {
    .mm-wrap { width:100% !important; }
    .mm-pad { padding-left:20px !important; padding-right:20px !important; }
    .mm-lead-h { font-size:22px !important; }
    .mm-name { font-size:26px !important; }
    .mm-num { width:30px !important; font-size:24px !important; }
    .mm-thumb, .mm-thumb img { width:72px !important; height:72px !important; }
    .mm-dek { display:none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.surface};">
<div style="display:none;font-size:1px;color:${C.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(previewText)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
${proofBar}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${C.surface};">
<tr>
<td align="center" style="padding:0;">

<table role="presentation" class="mm-wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;">

  <tr>
    <td align="center" style="padding:14px 24px 12px 24px;font-family:${SANS};font-size:12px;color:${C.mutedLight};">
      <a href="*|ARCHIVE|*" style="text-decoration:none;color:${C.mutedLight};">View this email in your browser</a>
    </td>
  </tr>

  <tr>
    <td align="center" style="padding:0;background-color:${C.white};border-radius:12px 12px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:26px 24px 20px 24px;">
            <a href="${home("logo")}" style="text-decoration:none;display:inline-block;">
              <img src="${esc(logoUrl)}" width="${logoWidth || T.logoWidth}" alt="${esc(NAME)}" style="display:block;width:${logoWidth || T.logoWidth}px;height:auto;border:0;outline:none;" />
            </a>
          </td>
        </tr>
        <tr><td style="padding:0;font-size:0;line-height:0;background-color:${C.brand};height:3px;">&nbsp;</td></tr>
        <tr>
          <td align="center" class="mm-pad" style="padding:30px 32px 0 32px;">
            <span class="mm-name" style="font-family:${SANS};font-size:32px;line-height:1.1;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">${T.emoji ? `${T.emoji} ` : ""}${esc(T.name)}</span>
          </td>
        </tr>
        ${spacer(10)}
        <tr>
          <td align="center" class="mm-pad" style="padding:0 32px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${C.mutedLight};">
            ${esc(issueDate)} &nbsp;&#183;&nbsp; Four stories, two minutes
          </td>
        </tr>
        ${spacer(16)}
        <tr>
          <td align="center" class="mm-pad" style="padding:0 48px;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.muted};">
            Good morning. Here is this week's featured story, followed by the three articles ${esc(NAME)} readers read most last week.
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td class="mm-pad" style="padding:30px 32px 34px 32px;background-color:${C.white};">${renderLead(lead, { campaign, T })}</td></tr>

  <tr><td class="mm-pad" style="padding:30px 32px 20px 32px;background-color:${C.white};border-top:1px solid ${C.line};">${renderMostRead(mostRead, { campaign, T })}</td></tr>

  <tr>
    <td align="center" class="mm-pad" style="padding:34px 32px 38px 32px;background-color:${C.surface};border-top:1px solid ${C.line};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="font-family:${SANS};font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};line-height:1.3;">${closingHead}</td>
        </tr>
        ${spacer(10)}
        <tr>
          <td align="center" style="font-family:${SANS};font-size:14px;line-height:1.55;color:${C.muted};">${closingBody}</td>
        </tr>
        ${spacer(22)}
        <tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td>${T.button(home("cta"), `Visit ${esc(NAME)}`)}</td></tr></table></td></tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="mm-pad" style="padding:36px 32px 38px 32px;background-color:${C.ink};border-radius:0 0 12px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:17px;font-weight:700;color:${C.white};line-height:1.3;">${esc(NAME)}</td>
        </tr>
        ${spacer(22)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${C.mutedLight};">
            You are receiving this because you are a named contact at ${T.uk ? "a UK business" : "a business"} in a sector we cover. We use your business contact details to send our briefings under our legitimate interest as a trade publisher. You can stop them at any time with one click.
          </td>
        </tr>
        ${spacer(26)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${C.mutedLight};">
            Published by Cogent Multimedia Ltd, 5 Jubilee Way, Faversham, Kent.
          </td>
        </tr>
        ${spacer(10)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${C.mutedLight};">
            ${footerLink("/privacy-policy/", "Privacy policy")} &nbsp;&nbsp;&#183;&nbsp;&nbsp; ${footerLink("/editorial-standards/", "Editorial standards")} &nbsp;&nbsp;&#183;&nbsp;&nbsp; ${footerLink("/contact/", "Contact")}
          </td>
        </tr>
        ${spacer(26)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${C.mutedLight};">
            <a href="*|UNSUB|*" style="color:${C.white};text-decoration:none;font-weight:700;">Unsubscribe</a>
            &nbsp;&nbsp;&#183;&nbsp;&nbsp;
            <a href="*|UPDATE_PROFILE|*" style="color:${C.mutedLight};text-decoration:none;">Update your preferences</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td align="center" class="mm-pad" style="padding:24px 32px 40px 32px;font-family:${SANS};font-size:11px;line-height:1.7;color:${C.mutedLight};">*|HTML:LIST_ADDRESS_HTML|*</td></tr>

</table>

</td>
</tr>
</table>
</body>
</html>`;
}
