"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { IMPORT_FIELDS, guessMapping, parseCsv, rowToRecord } from "@/lib/advertiser-csv";
import { importAdvertiserChunk, importResearchLists } from "@/lib/advertiser-actions";
import BlackBookTitlePills, { hasTitle } from "./BlackBookTitlePills";

// CSV import for the advertiser list: pick a file, check the column guesses,
// pick the titles, import. The file is parsed here so the preview is instant,
// then sent in chunks well under the server-action body limit; the server
// re-reads every row itself.

const CHUNK = 400;

export default function AdvertiserImport({ sites, researchCount }) {
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, start] = useTransition();
  const formRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setResult(null);
    setErr("");
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setErr("That file has no rows under its header.");
      setTable(null);
      return;
    }
    const [headers, ...body] = rows;
    setFileName(file.name);
    setTable({ headers, rows: body });
    setMapping(guessMapping(headers));
  };

  // What the import would do, worked out from the same function the server uses.
  const preview = useMemo(() => {
    if (!table || !mapping) return null;
    const domains = new Set();
    let contacts = 0;
    const skipped = {};
    for (const r of table.rows) {
      const rec = rowToRecord(r, mapping);
      if (rec.skip) {
        skipped[rec.skip] = (skipped[rec.skip] || 0) + 1;
        continue;
      }
      domains.add(rec.domain);
      if (rec.contact) contacts++;
      if (rec.personalDropped) {
        const why = "Personal email address (brand kept, person left off)";
        skipped[why] = (skipped[why] || 0) + 1;
      }
    }
    return { brands: domains.size, contacts, skipped };
  }, [table, mapping]);

  const run = () => {
    const form = formRef.current;
    if (!hasTitle(form)) {
      setErr("Pick at least one title, or All titles.");
      return;
    }
    const fd = new FormData(form);
    const opts = {
      mapping,
      allTitles: fd.get("allTitles") === "on",
      siteIds: fd.getAll("siteIds").map(String),
      sourceDetail: fd.get("sourceDetail")?.toString() || fileName,
    };
    setErr("");
    start(async () => {
      const total = { created: 0, merged: 0, contactsAdded: 0, contactsExisting: 0, skipped: {} };
      for (let i = 0; i < table.rows.length; i += CHUNK) {
        setProgress(`Importing rows ${i + 1}–${Math.min(i + CHUNK, table.rows.length)} of ${table.rows.length}…`);
        const r = await importAdvertiserChunk({ ...opts, rows: table.rows.slice(i, i + CHUNK) });
        if (!r?.ok) {
          setErr(r?.message || "The import stopped part way. Rows already imported are kept.");
          break;
        }
        for (const k of ["created", "merged", "contactsAdded", "contactsExisting"]) total[k] += r[k];
        for (const [why, n] of Object.entries(r.skipped)) total.skipped[why] = (total.skipped[why] || 0) + n;
      }
      setProgress("");
      setResult(total);
      setTable(null);
    });
  };

  const pullResearch = () =>
    start(async () => {
      const r = await importResearchLists();
      setResult({ research: r });
    });

  return (
    <div className="adv-import">
      <div className="adv-import-head">
        <label className="btn" style={{ cursor: "pointer" }}>
          Choose CSV…
          <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
        </label>
        <span className="micro" style={{ color: "var(--muted)" }}>
          Apollo, HubSpot, Sales Navigator or a hand-made sheet. One row per person; brands are matched on their
          website or email domain.
        </span>
        {researchCount > 0 && (
          <button type="button" className="btn-ghost" onClick={pullResearch} disabled={busy} style={{ marginLeft: "auto" }}>
            Pull in title research lists ({researchCount})
          </button>
        )}
      </div>

      {table && mapping && (
        <form ref={formRef} onSubmit={(e) => (e.preventDefault(), run())} className="adv-import-body">
          <p className="micro" style={{ margin: 0 }}>
            <strong>{fileName}</strong> · {table.rows.length} rows. Check the columns:
          </p>
          <div className="adv-map">
            {IMPORT_FIELDS.map((f) => (
              <label key={f.key} className="field">
                <span className="micro">{f.label}</span>
                <select
                  value={mapping[f.key]}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                >
                  <option value={-1}>—</option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <BlackBookTitlePills sites={sites} selected={null} />

          <label className="field" style={{ maxWidth: 420 }}>
            <span className="micro">Where is this list from?</span>
            <input name="sourceDetail" placeholder={fileName} />
          </label>

          {preview && (
            <div className="adv-preview">
              <span>
                <strong>{preview.brands}</strong> brands
              </span>
              <span>
                <strong>{preview.contacts}</strong> contacts
              </span>
              {Object.entries(preview.skipped).map(([why, n]) => (
                <span key={why} style={{ color: "var(--neon-amber)" }}>
                  {n} skipped: {why.toLowerCase()}
                </span>
              ))}
              <span className="micro" style={{ color: "var(--muted)" }}>
                Brands already on the list are merged, and anyone who opted out is left off.
              </span>
            </div>
          )}

          <div className="bb-actions">
            <button type="submit" className="btn" disabled={busy || !preview?.brands}>
              {busy ? "Importing…" : `Import ${preview?.brands ?? 0} brands`}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setTable(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {progress && <p className="micro" style={{ margin: "10px 0 0" }}>{progress}</p>}
      {err && <p className="field-err" style={{ margin: "10px 0 0" }}>{err}</p>}

      {result && !result.research && (
        <p className="micro" style={{ margin: "10px 0 0", color: "var(--neon-green)" }}>
          Done: {result.created} new brands, {result.merged} already listed and merged, {result.contactsAdded} new contacts
          {result.contactsExisting ? `, ${result.contactsExisting} contacts already held` : ""}.
          {Object.entries(result.skipped).map(([why, n]) => ` ${n} skipped (${why.toLowerCase()}).`)}
        </p>
      )}
      {result?.research && (
        <p className="micro" style={{ margin: "10px 0 0", color: "var(--neon-green)" }}>
          Research lists pulled in: {result.research.created} new brands, {result.research.merged} merged
          {result.research.noSite ? `, ${result.research.noSite} left behind with no website` : ""}.
        </p>
      )}
    </div>
  );
}
