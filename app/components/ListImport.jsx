"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCSV, mapColumns, slimRow } from "@/lib/apollo-csv";

// The upload box on /lists. Parses the Apollo export here in the browser and
// sends it up in chunks: the server never sees the whole file, and a chunk that
// fails is resent rather than the whole upload starting again (the server skips
// anything it already holds, so a resend is harmless).

const CHUNK = 500;
const RETRIES = 2;

const LABELS = {
  added: "added",
  queued: "queued for the drip",
  dupes: "already held or repeated",
  offTitle: "off-title (Claude)",
  catchAll: "catch-all",
  knownBad: "known bad elsewhere",
  noMx: "dead domain",
  badEmail: "no usable email",
};

export default function ListImport({ titles }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [totals, setTotals] = useState(null);
  const busy = progress && !progress.done;

  async function choose(f) {
    setFile(f);
    setParsed(null);
    setTotals(null);
    setProgress(null);
    setError(null);
    if (!f) return;
    const rows = parseCSV(await f.text()).filter((r) => r.some((c) => c.trim()));
    if (rows.length < 2) return setError("That file has no rows under the header.");
    const { index, missing } = mapColumns(rows[0]);
    if (missing.length) {
      return setError(
        `This doesn't look like an Apollo export: no ${missing.map((m) => `"${m}"`).join(", ")} column. ` +
          "Export from Apollo with the default columns and try again."
      );
    }
    setParsed(rows.slice(1).map((r) => slimRow(r, index)));
  }

  async function send() {
    if (!slug || !parsed) return;
    const upload = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, file: file.name };
    const sum = {};
    const chunks = Math.ceil(parsed.length / CHUNK);
    setError(null);
    setTotals(null);

    for (let c = 0; c < chunks; c++) {
      setProgress({ chunk: c + 1, chunks });
      const rows = parsed.slice(c * CHUNK, (c + 1) * CHUNK);
      let out = null, lastErr = null;
      for (let attempt = 0; attempt <= RETRIES && !out; attempt++) {
        try {
          const res = await fetch("/api/lists/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, rows, upload }),
          });
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          out = data;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!out) {
        setProgress({ chunk: c + 1, chunks, done: true });
        setTotals({ ...sum });
        setError(
          `Stopped at part ${c + 1} of ${chunks}: ${lastErr?.message}. ` +
            "Everything before it is in. Upload the same file again to carry on; rows already added are skipped."
        );
        router.refresh();
        return;
      }
      for (const [k, v] of Object.entries(out.counts)) sum[k] = (sum[k] ?? 0) + v;
      setTotals({ ...sum });
    }
    setProgress({ chunks, chunk: chunks, done: true });
    router.refresh();
  }

  return (
    <section className="lists-card">
      <h2>Top up a list</h2>
      <p className="lists-note">
        Upload an Apollo export for one title. Duplicates and dead addresses are dropped, Claude checks each person
        fits the magazine, and the rest join the back of that title&rsquo;s drip queue. The Tuesday and Friday runs
        take them into Mailchimp at the title&rsquo;s weekly rate. Nothing is sent to Mailchimp from here.
      </p>

      <div className="lists-form">
        <label>
          <span>Title</span>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy}>
            <option value="">Choose a title…</option>
            {titles.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Apollo CSV</span>
          <input type="file" accept=".csv,text/csv" disabled={busy}
            onChange={(e) => choose(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" className="lists-btn" disabled={!slug || !parsed || busy} onClick={send}>
          {busy ? `Working… part ${progress.chunk} of ${progress.chunks}` : parsed ? `Add ${parsed.length.toLocaleString()} rows` : "Add to queue"}
        </button>
      </div>

      {busy && (
        <div className="lists-bar" aria-hidden="true">
          <div style={{ width: `${((progress.chunk - 1) / progress.chunks) * 100}%` }} />
        </div>
      )}
      {error && <p className="lists-error">{error}</p>}
      {totals && (
        <div className="lists-result">
          {progress?.done && !error && <strong>Done. </strong>}
          {Object.entries(LABELS)
            .filter(([k]) => totals[k])
            .map(([k, label]) => `${totals[k].toLocaleString()} ${label}`)
            .join(" · ")}
        </div>
      )}
    </section>
  );
}
