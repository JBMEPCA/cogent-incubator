// Apollo CSV handling that both the browser and the server need.
//
// Kept free of imports on purpose: the Newsletter lists page parses the file in
// the browser and sends only the columns below, so a 15MB Apollo export (it
// carries ~80 columns, most of them phone numbers and funding rounds) goes up
// as a fraction of that, in chunks a serverless function can take.

/** Same parser as scripts/rank-prospects.mjs: quoted fields, doubled quotes, CRLF. */
export function parseCSV(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// Apollo's own headers, as its export writes them. Matched case-insensitively,
// because a file that has been through Excel sometimes comes back retitled.
const COLUMNS = {
  email: ["Email"],
  firstName: ["First Name"],
  lastName: ["Last Name"],
  title: ["Title"],
  company: ["Company Name", "Company"],
  country: ["Company Country", "Country"],
  sic: ["SIC Codes"],
  industry: ["Industry"],
  keywords: ["Keywords"],
  catchAll: ["Primary Email Catch-all Status"],
  verifiedAt: ["Primary Email Last Verified At"],
  verifySource: ["Primary Email Verification Source"],
};

/**
 * Header row to a field→index map. Returns `missing` rather than throwing so the
 * page can tell Lucas which column it could not find before anything is sent.
 */
export function mapColumns(header) {
  const norm = header.map((h) => h.replace(/^﻿/, "").trim().toLowerCase());
  const index = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    const i = norm.findIndex((h) => names.some((n) => n.toLowerCase() === h));
    if (i !== -1) index[field] = i;
  }
  const missing = ["email", "title", "company"].filter((f) => index[f] === undefined);
  return { index, missing };
}

/** One CSV row to the slim object the import route takes. */
export function slimRow(cells, index) {
  const out = {};
  for (const [field, i] of Object.entries(index)) {
    const v = (cells[i] ?? "").trim();
    if (v) out[field] = field === "keywords" ? v.slice(0, 200) : v.slice(0, 255);
  }
  return out;
}
