// Reading advertiser lists out of a CSV, shared by the import screen (which
// previews in the browser) and the server action (which checks it all again,
// because the browser's word is not a control).
//
// No imports, on purpose: this runs in the browser as well as on the server.

/**
 * RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside
 * quotes, CRLF or LF, a leading BOM. Apollo, HubSpot and Excel exports all
 * fit. Returns an array of arrays of strings.
 */
export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines, including the one a trailing newline leaves.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** The fields an import can fill, in the order the mapping screen shows them. */
export const IMPORT_FIELDS = [
  { key: "company", label: "Company" },
  { key: "website", label: "Website" },
  { key: "email", label: "Email" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "jobTitle", label: "Job title" },
  { key: "phone", label: "Phone" },
  { key: "linkedinUrl", label: "LinkedIn" },
  { key: "category", label: "Category" },
];

// Header names as Apollo, HubSpot, LinkedIn Sales Navigator and a hand-made
// sheet tend to spell them. First match wins, so the more specific spelling
// goes first ("company name for emails" is Apollo's cleaned-up name).
const SYNONYMS = {
  company: ["company name for emails", "company", "company name", "organisation", "organization", "account name", "business name", "brand"],
  website: ["website", "company website", "website url", "url", "domain", "company domain", "web"],
  email: ["email", "email address", "work email", "e-mail", "business email"],
  firstName: ["first name", "firstname", "forename", "given name"],
  lastName: ["last name", "lastname", "surname", "family name"],
  fullName: ["name", "full name", "contact name", "contact"],
  jobTitle: ["title", "job title", "position", "role", "job role"],
  phone: ["corporate phone", "work direct phone", "phone", "phone number", "telephone", "mobile phone", "company phone"],
  linkedinUrl: ["person linkedin url", "linkedin url", "linkedin", "linkedin profile"],
  category: ["industry", "category", "sector"],
};

const norm = (h) => String(h || "").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

/** { field: columnIndex } guessed from the header row; -1 when nothing fits. */
export function guessMapping(headers) {
  const cols = headers.map(norm);
  const used = new Set();
  const out = {};
  for (const { key } of IMPORT_FIELDS) {
    out[key] = -1;
    for (const name of SYNONYMS[key]) {
      const i = cols.findIndex((c, idx) => c === name && !used.has(idx));
      if (i !== -1) {
        out[key] = i;
        used.add(i);
        break;
      }
    }
  }
  return out;
}

// Personal mailboxes say nothing about the company, so a contact on one of
// these never decides which brand a row belongs to.
export const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com",
  "live.co.uk", "msn.com", "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "mac.com",
  "aol.com", "btinternet.com", "sky.com", "talktalk.net", "virginmedia.com", "ntlworld.com",
  "protonmail.com", "proton.me", "gmx.com", "mail.com", "zoho.com",
]);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "https://www.Brand.co.uk/about" → "brand.co.uk". Null when there is no
 * plausible domain in it.
 */
export function normaliseDomain(value) {
  let s = String(value || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@")) s = s.split("@").pop();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#:\s]/)[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

/**
 * One CSV row as a record the server can store, or { skip: reason }.
 *
 * The brand's domain comes from its website first and its contact's email
 * second, and never from a free-mail address: a row of gmail.com contacts
 * would otherwise all collapse into one "advertiser" called gmail.com.
 */
export function rowToRecord(row, mapping) {
  const get = (k) => (mapping[k] >= 0 ? String(row[mapping[k]] ?? "").trim() : "");

  let email = get("email").toLowerCase();
  if (email && !EMAIL_RE.test(email)) email = "";

  let firstName = get("firstName");
  let lastName = get("lastName");
  const full = get("fullName");
  if (full && !firstName && !lastName) {
    const parts = full.split(/\s+/);
    firstName = parts.shift() || "";
    lastName = parts.join(" ");
  }

  const fromSite = normaliseDomain(get("website"));
  const emailDomain = email ? email.split("@")[1] : null;
  const domain = fromSite || (emailDomain && !FREE_MAIL.has(emailDomain) ? emailDomain : null);

  const company = get("company") || (domain ? domain.split(".")[0].replace(/^./, (c) => c.toUpperCase()) : "");

  if (!domain) {
    return { skip: email && FREE_MAIL.has(emailDomain) ? "Personal email and no website" : "No website or company email" };
  }
  return {
    company,
    domain,
    website: get("website") || null,
    category: get("category") || null,
    // A personal mailbox is an individual subscriber under PECR, not a company
    // contact, so it cannot be mailed cold. The brand stays; the person doesn't.
    personalDropped: Boolean(email && FREE_MAIL.has(emailDomain)),
    contact: email && !FREE_MAIL.has(emailDomain)
      ? {
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          jobTitle: get("jobTitle") || null,
          phone: get("phone") || null,
          linkedinUrl: get("linkedinUrl") || null,
        }
      : null,
  };
}
