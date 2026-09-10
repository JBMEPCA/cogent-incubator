// One shared shape for every prospecting script's output.
//
// The point of a common format is that the harvesters stay dumb and separate.
// f:Entrepreneur, an exhibitor directory and a company's own team page have
// nothing in common as web pages, but they all answer the same four questions,
// and a row that answers all four is a person we can write to. Anything that
// answers only some of them is a lead, not a target, and the CSV says which by
// leaving the field empty rather than by guessing.
//
// Columns, in order:
//   name    the person. Empty means we have a company but no human yet.
//   role    their job title, as printed by the source. Never inferred.
//   company
//   domain
//   email   the address we would actually send to.
//   source  which harvester and which page produced the row, so a bad row can
//           be traced back rather than argued about.
//   hookUrl the page that makes this person worth writing to.

import fs from "node:fs";
import path from "node:path";

export const COLUMNS = ["name", "role", "company", "domain", "email", "source", "hookUrl"];

const cell = (v) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeRoster(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(",")).join("\n");
  fs.writeFileSync(file, `${COLUMNS.join(",")}\n${body}\n`, "utf8");
  return rows.length;
}

export function readRoster(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  lines.shift();
  return lines.map((line) => {
    // Small hand-rolled parse rather than a dependency: these files are ours
    // and the only quoting they contain is the quoting writeRoster emits.
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return Object.fromEntries(COLUMNS.map((c, i) => [c, out[i] || ""]));
  });
}

// Merge new rows into a file, keyed on email first and then on person plus
// company, because the same person turns up in two directories under two
// spellings of the same job title and should still be one row. Later rows fill
// in blanks on earlier ones rather than replacing them, so an enrichment pass
// can add an address without losing the hook that found the person.
export function mergeRoster(file, incoming) {
  const existing = readRoster(file);
  const byKey = new Map();
  const keyOf = (r) =>
    (r.email && r.email.toLowerCase()) ||
    `${(r.name || "").toLowerCase()}|${(r.company || r.domain || "").toLowerCase()}`;

  for (const r of [...existing, ...incoming]) {
    const k = keyOf(r);
    if (!k || k === "|") continue;
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, { ...r });
    else for (const c of COLUMNS) if (!prev[c] && r[c]) prev[c] = r[c];
  }
  const rows = [...byKey.values()];
  writeRoster(file, rows);
  return { total: rows.length, added: rows.length - existing.length };
}

export const summarise = (rows) => ({
  rows: rows.length,
  withEmail: rows.filter((r) => r.email).length,
  withName: rows.filter((r) => r.name).length,
  ready: rows.filter((r) => r.email && r.name).length,
});
