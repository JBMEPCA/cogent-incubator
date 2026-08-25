/**
 * Smart SME Weekly — the email itself.
 *
 * The shell is FLAT and never changes. Ten mc:edit regions (lead, story2..10)
 * ship empty in the Mailchimp template; each week's campaign fills them via the
 * /content `sections` parameter. That split matters: if the stories lived in the
 * template, editing the chrome later would rewrite every issue already in the
 * *|ARCHIVE|* view with this week's articles.
 *
 * Email rules this obeys, every one of them learned from a proof that broke:
 *   - table layout, styles inline
 *   - NOTHING relies on padding or margin on a <div> or an inline element. JB's
 *     client strips those, which silently collapsed the CTA button onto the copy
 *     above it. Vertical space is always a spacer <tr>.
 *   - no background-coloured hairline cells and no thin rules anywhere. Both got
 *     reinterpreted by dark-mode transforms and drew phantom lines in the footer.
 *   - Space Grotesk via an mso-guarded Google Fonts link, Arial underneath
 *   - every image wrapped in a link, no underlines, no em dashes
 */

// Brand tokens, lifted from the site's theme.json so the email cannot drift.
export const BRAND = {
  brand: "#2E3EEE",
  ink: "#0A0C16",
  surface: "#F4F5FA",
  line: "#E3E5EF",
  muted: "#5A5E75",
  mutedLight: "#A9AECB",
  white: "#FFFFFF",
};

// Mirrors the --cat-color rules in the theme's style.css.
export const CAT_COLOR = {
  Finance: "#059669",
  Operations: "#0891B2",
  Marketing: "#8B5CF6",
  "Case Studies": "#D97706",
  News: "#D0202B",
  "AI & Automation": BRAND.brand,
};

const SANS = "'Space Grotesk', Arial, Helvetica, sans-serif";

export const SECTION_KEYS = [
  "lead",
  ...Array.from({ length: 9 }, (_, i) => `story${i + 2}`),
];

// ---- text helpers ----

// WordPress mixes named and numeric entities and double encodes ampersands as
// &#038; in titles. Numeric first, then named.
export const decode = (s = "") =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#?39;/g, "'")
    .replace(/&amp;/g, "&");

export const strip = (s = "") =>
  decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// House rule: no em dashes in anything published.
export const noEmDash = (s = "") => s.replace(/\s*[—–]\s*/g, ", ");

const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "...");

const clean = (s, n) => esc(noEmDash(n ? clip(strip(s), n) : strip(s)));

// ---- link tagging ----

/**
 * Every link out of the email carries UTM parameters, applied here rather than
 * written by hand, because a link added later without them is invisible.
 *
 * A click from an email client arrives with no referrer, so GA4 files an
 * untagged newsletter click under Direct, next to bookmarks and typed-in
 * addresses. That made the newsletter impossible to measure: the analytics page
 * showed a large Direct number that could not be attributed to anything.
 * Tagged, the same clicks land in the Email channel and can be counted.
 */
export const UTM_SOURCE = "newsletter";
export const UTM_MEDIUM = "email";

/** Stable, sortable, one per issue: newsletter-2026-08-17. */
export const campaignId = (date = new Date()) => `newsletter-${date.toISOString().slice(0, 10)}`;

/**
 * Tag one URL. Anything that is not ours to tag comes back untouched: Mailchimp
 * merge tags (*|ARCHIVE|*, *|UNSUB|*), anchors, and mailto: links. Tagging that
 * is already present is never overwritten.
 */
export function tagged(url, { campaign, content } = {}) {
  if (!/^https?:\/\//i.test(url || "")) return url;
  let u;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.searchParams.has("utm_source")) return u.toString();
  u.searchParams.set("utm_source", UTM_SOURCE);
  u.searchParams.set("utm_medium", UTM_MEDIUM);
  if (campaign) u.searchParams.set("utm_campaign", campaign);
  // Which slot earned the click. The lead is expensive real estate and this is
  // the only way to find out whether it is worth what it costs.
  if (content) u.searchParams.set("utm_content", content);
  return u.toString();
}

const spacer = (px) =>
  `<tr><td height="${px}" style="height:${px}px;font-size:0;line-height:${px}px;">&nbsp;</td></tr>`;

const kicker = (cat) =>
  `<span style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${
    CAT_COLOR[cat] ?? BRAND.brand
  };">${esc(cat)}</span>`;

// ---- story slots (the only thing that changes week to week) ----

export function renderLead(s, { campaign } = {}) {
  const href = esc(tagged(s.link, { campaign, content: "lead" }));
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <tr>
    <td style="padding:0 0 18px 0;">
      <a href="${href}" style="text-decoration:none;display:block;">
        <img src="${esc(s.imageLead)}" width="600" alt="${clean(s.title)}"
          style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;border-radius:10px;" />
      </a>
    </td>
  </tr>
  <tr><td style="padding:0 0 8px 0;">${kicker(s.category)}</td></tr>
  <tr>
    <td style="padding:0 0 10px 0;">
      <a href="${href}" style="text-decoration:none;color:${BRAND.ink};">
        <span class="ss-lead-h" style="font-family:${SANS};font-size:27px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${BRAND.ink};">${clean(s.title)}</span>
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 16px 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${BRAND.muted};">${clean(s.excerpt)}</td>
  </tr>
  <tr>
    <td>
      <a href="${href}" style="text-decoration:none;font-family:${SANS};font-size:15px;font-weight:700;color:${BRAND.brand};">Read the full story &rsaquo;</a>
    </td>
  </tr>
</table>`;
}

export function renderRow(s, { campaign, slot = "story" } = {}) {
  const href = esc(tagged(s.link, { campaign, content: slot }));
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <tr>
    <td class="ss-thumb" width="150" valign="top" style="width:150px;padding:0 16px 0 0;">
      <a href="${href}" style="text-decoration:none;display:block;">
        <img src="${esc(s.imageThumb)}" width="150" alt="${clean(s.title)}"
          style="display:block;width:150px;height:auto;border:0;outline:none;border-radius:8px;" />
      </a>
    </td>
    <td class="ss-copy" valign="top" style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr><td style="padding:0 0 6px 0;">${kicker(s.category)}</td></tr>
        <tr>
          <td style="padding:0;">
            <a href="${href}" style="text-decoration:none;color:${BRAND.ink};">
              <span style="font-family:${SANS};font-size:17px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${BRAND.ink};">${clean(s.title)}</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:7px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${BRAND.muted};">${clean(s.excerpt, 95)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** The ten section values for a campaign, keyed to the mc:edit regions. */
export function renderSections(stories, { campaign } = {}) {
  if (stories.length !== 10) throw new Error(`Need exactly 10 stories, got ${stories.length}`);
  const [lead, ...rest] = stories;
  const sections = { lead: renderLead(lead, { campaign }) };
  rest.forEach((s, i) => {
    const slot = `story${i + 2}`;
    sections[slot] = renderRow(s, { campaign, slot });
  });
  return sections;
}

// ---- the shell (fixed forever) ----

export function renderShell({ site, issueDate, logoUrl, campaign }) {
  const NAME = site?.name || "";
  const HOME = site?.domain ? `https://${String(site.domain).replace(/^https?:\/\//, "")}` : "#";
  // The chrome links are tagged too, and separately from the stories: a click on
  // the wordmark is a different signal from a click on a headline.
  const home = (content) => esc(tagged(HOME, { campaign, content }));
  const ACCENT = site?.accentHex || BRAND.brand;
  const slot = (key) => `<td mc:edit="${key}" style="padding:0;"></td>`;

  const rows = Array.from({ length: 9 }, (_, i) => {
    const key = `story${i + 2}`;
    // The rule between rows is a real border on a content cell, which renders
    // reliably. It is the hairline SPACER cells that had to go.
    return `
      <tr>
        <td style="padding:20px 0;border-top:1px solid ${BRAND.line};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
            <tr>${slot(key)}</tr>
          </table>
        </td>
      </tr>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(NAME)}</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
<!--<![endif]-->
<!--[if mso]>
<style>* { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
  @media only screen and (max-width:520px) {
    .ss-wrap { width:100% !important; }
    .ss-pad { padding-left:20px !important; padding-right:20px !important; }
    .ss-thumb, .ss-copy { display:block !important; width:100% !important; padding:0 !important; }
    .ss-thumb { padding-bottom:12px !important; }
    .ss-thumb img { width:100% !important; }
    .ss-lead-h { font-size:23px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};">
<div style="display:none;font-size:1px;color:${BRAND.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">*|MC_PREVIEW_TEXT|*</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${BRAND.surface};">
<tr>
<td align="center" style="padding:0;">

<table role="presentation" class="ss-wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;">

  <tr>
    <td align="center" style="padding:14px 24px 12px 24px;font-family:${SANS};font-size:12px;color:${BRAND.mutedLight};">
      <a href="*|ARCHIVE|*" style="text-decoration:none;color:${BRAND.mutedLight};">View this email in your browser</a>
    </td>
  </tr>

  <tr>
    <td align="center" style="padding:0;background-color:${BRAND.white};border-radius:12px 12px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:30px 24px 22px 24px;">
            <a href="${home("logo")}" style="text-decoration:none;display:inline-block;">
              <img src="${esc(logoUrl)}" width="190" alt="${esc(NAME)}"
                style="display:block;width:190px;height:auto;border:0;outline:none;" />
            </a>
          </td>
        </tr>
        <tr><td style="padding:0;font-size:0;line-height:0;background-color:${BRAND.brand};height:3px;">&nbsp;</td></tr>
        <tr>
          <td align="center" style="padding:14px 24px 0 24px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.mutedLight};">
            The weekly briefing &nbsp;&#183;&nbsp; ${esc(issueDate)}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="ss-pad" style="padding:26px 32px 22px 32px;background-color:${BRAND.white};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>${slot("lead")}</tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="ss-pad" style="padding:6px 32px 0 32px;background-color:${BRAND.white};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0 0 0;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.ink};">
            More this week
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="ss-pad" style="padding:8px 32px 26px 32px;background-color:${BRAND.white};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
${rows}
      </table>
    </td>
  </tr>

  <tr>
    <td align="center" class="ss-pad" style="padding:38px 32px 42px 32px;background-color:${BRAND.surface};border-top:1px solid ${BRAND.line};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="font-family:${SANS};font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.ink};line-height:1.3;">
            More guidance, every day
          </td>
        </tr>
        ${spacer(16)}
        <tr>
          <td align="center" style="font-family:${SANS};font-size:14px;line-height:1.55;color:${BRAND.muted};">
            ${site?.strapline || `Practical guidance for ${site?.audience || "our readers"}.`}
          </td>
        </tr>
        ${spacer(34)}
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;">
              <tr>
                <td align="center" bgcolor="${BRAND.brand}" style="border-radius:8px;padding:15px 34px;mso-padding-alt:15px 34px;">
                  <a href="${home("cta")}" style="display:block;font-family:${SANS};font-size:15px;font-weight:700;line-height:1;color:${BRAND.white};text-decoration:none;white-space:nowrap;">Visit ${esc(NAME)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="ss-pad" style="padding:40px 32px 42px 32px;background-color:${BRAND.ink};border-radius:0 0 12px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:17px;font-weight:700;letter-spacing:0.01em;color:${BRAND.white};line-height:1.3;">
            ${esc(NAME)}
          </td>
        </tr>
        ${spacer(26)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${BRAND.mutedLight};">
            You are receiving this because you are a named contact at a UK business in a sector we cover. We use your business contact details to send this weekly briefing under our legitimate interest as a trade publisher. You can stop it at any time with one click.
          </td>
        </tr>
        ${spacer(30)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${BRAND.mutedLight};">
            Published by Cogent Multimedia Ltd, 5 Jubilee Way, Faversham, Kent.
          </td>
        </tr>
        ${spacer(10)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${BRAND.mutedLight};">
            <a href="${esc(tagged(`${HOME}/privacy-policy/`, { campaign, content: "footer" }))}" style="color:${BRAND.mutedLight};text-decoration:none;">Privacy policy</a>
            &nbsp;&nbsp;&#183;&nbsp;&nbsp;
            <a href="${esc(tagged(`${HOME}/editorial-standards/`, { campaign, content: "footer" }))}" style="color:${BRAND.mutedLight};text-decoration:none;">Editorial standards</a>
            &nbsp;&nbsp;&#183;&nbsp;&nbsp;
            <a href="${esc(tagged(`${HOME}/contact/`, { campaign, content: "footer" }))}" style="color:${BRAND.mutedLight};text-decoration:none;">Contact</a>
          </td>
        </tr>
        ${spacer(30)}
        <tr>
          <td style="padding:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${BRAND.mutedLight};">
            <a href="*|UNSUB|*" style="color:${BRAND.white};text-decoration:none;font-weight:700;">Unsubscribe</a>
            &nbsp;&nbsp;&#183;&nbsp;&nbsp;
            <a href="*|UPDATE_PROFILE|*" style="color:${BRAND.mutedLight};text-decoration:none;">Update your preferences</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td align="center" class="ss-pad" style="padding:26px 32px 40px 32px;font-family:${SANS};font-size:11px;line-height:1.7;color:${BRAND.mutedLight};">
    <span style="font-family:${SANS};font-size:11px;line-height:1.7;color:${BRAND.mutedLight};">*|HTML:LIST_ADDRESS_HTML|*</span>
  </td></tr>

</table>

</td>
</tr>
</table>
</body>
</html>`;
}

/**
 * The shell with its ten regions filled in — what the issue will actually look
 * like in an inbox.
 *
 * Mailchimp does this itself at send time by substituting each `mc:edit`
 * region, so nothing in the sending path needs it. A proof does: the shell and
 * the sections are useless separately, and the only way anyone reviewed an
 * issue before sending was to send it.
 *
 * Mailchimp merge tags (*|UNSUB|*, *|HTML:LIST_ADDRESS_HTML|*) are left alone.
 * They are inert in a browser and visible as themselves, which is the honest
 * thing for a proof: they show where the real values will land rather than
 * pretending the footer is finished.
 */
export function spliceSections(shell, sections) {
  return shell.replace(
    /<td mc:edit="([a-z0-9]+)"([^>]*)><\/td>/gi,
    (whole, key, attrs) => (sections[key] ? `<td${attrs}>${sections[key]}</td>` : whole)
  );
}
