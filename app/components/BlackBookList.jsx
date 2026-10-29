"use client";

import { useState } from "react";
import BlackBookRow from "./BlackBookRow";

// The Black Book's list with its filters: a text search, a title and a sales
// person. All in the browser, because the whole book is already on the page
// and a few hundred rows filter instantly. The rows arrive in their final
// order (due follow-ups first, see dueFirst), and filtering keeps it.
//
// A contact marked All titles is relevant to every title, so it shows under
// any title picked.

const UNALLOCATED = "__none";

export default function BlackBookList({ contacts, sites, salesPeople }) {
  const [q, setQ] = useState("");
  const [site, setSite] = useState("");
  const [seller, setSeller] = useState("");
  const names = new Map(sites.map((s) => [s.id, s.name]));

  const needle = q.trim().toLowerCase();
  const shown = contacts.filter((c) => {
    if (site && c.siteIds.length > 0 && !c.siteIds.includes(site)) return false;
    if (seller === UNALLOCATED && c.salesPerson) return false;
    if (seller && seller !== UNALLOCATED && c.salesPerson !== seller) return false;
    if (!needle) return true;
    const titles = c.siteIds.length ? c.siteIds.map((id) => names.get(id) || "") : ["All titles"];
    return [c.company, c.name, c.email, c.notes, c.salesPerson, ...titles]
      .filter(Boolean)
      .some((s) => s.toLowerCase().includes(needle));
  });
  const filtered = needle || site || seller;

  return (
    <>
      <div className="bb-filters" role="search">
        <label className="field">
          <span className="micro">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Company, name, email, notes or title"
          />
        </label>
        <label className="field">
          <span className="micro">Title</span>
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Every title</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="micro">Sales person</span>
          <select value={seller} onChange={(e) => setSeller(e.target.value)}>
            <option value="">Anyone</option>
            <option value={UNALLOCATED}>Not allocated</option>
            {salesPeople.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <span className="micro bb-filter-count">
          {filtered ? `${shown.length} of ${contacts.length}` : `${contacts.length} contacts`}
        </span>
      </div>

      {shown.length > 0 ? (
        <div className="bb-list">
          {shown.map((c) => (
            <BlackBookRow key={c.id} contact={c} sites={sites} />
          ))}
        </div>
      ) : (
        <p className="micro" style={{ color: "var(--muted)", marginTop: 14 }}>
          No contacts match.
        </p>
      )}
    </>
  );
}
