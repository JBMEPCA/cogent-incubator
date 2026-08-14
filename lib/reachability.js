// Which companies will actually answer an email.
//
// Lives on its own because two very different parts of the system need it: the
// outreach engine, to avoid emailing companies that will never reply, and the
// QA gate, to notice when a guide has named nothing but household names and so
// left us nobody to contact. Putting it in either one would have made the other
// import a chain it has no business importing.
//
// The first nine outreach emails went to Google, Microsoft, Adobe, HMRC and the
// Intellectual Property Office, and won nothing.
//
// This is a judgement about who replies, NOT about who is worth writing about.
// An article should name these companies whenever they are genuinely the story.

// Brands arrive with a product word attached -- "Revolut Business", "Monzo
// Business" -- which slipped straight past an exact match on the parent name.
// Stripped rather than matched as a substring, because a substring rule on
// short entries like "bt" or "sky" would suppress half the list by accident.
// \b keeps "uk" from eating the UK in UKRI.
export const canonBrand = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\b(business|uk|ltd|limited|plc|group|inc|llc|corp|corporation)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

const NEVER_REPLIES = new Set(
  [
    "google", "microsoft", "adobe", "amazon", "apple", "meta", "facebook", "linkedin",
    "openai", "anthropic", "ibm", "oracle", "sap", "cisco", "dell", "samsung",
    "salesforce", "hubspot", "canva", "dropbox", "atlassian", "slack", "zoom",
    "shopify", "stripe", "paypal", "intuit", "quickbooks", "xero", "sage", "mailchimp",
    "semrush", "ahrefs", "hootsuite", "buffer", "klaviyo", "activecampaign",
    "monzo", "starling", "revolut", "barclays", "natwest", "lloyds", "hsbc", "santander",
    "bt", "vodafone", "sky", "virgin media", "royal mail",
  ].map(canonBrand)
);

// Public bodies publish guidance, not backlinks, and arrive under a dozen
// different spellings, so these match on the name rather than an exact entry.
const PUBLIC_BODY =
  /\b(hmrc|hm revenue|gov\.?uk|department for|dept for|ministry of|companies house|intellectual property office|ukri|innovate uk|ofcom|ofgem|ofsted|the fca|bank of england|british business bank|hm treasury)\b/i;

export function isUnreachable(name) {
  return NEVER_REPLIES.has(canonBrand(name)) || PUBLIC_BODY.test(String(name || ""));
}
