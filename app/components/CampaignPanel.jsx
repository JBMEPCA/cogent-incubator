"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CampaignAssetUpload from "./CampaignAssetUpload";
import { deleteAsset, refreshCampaignStats, setAssetActive, setPaused, updatePlacement } from "@/lib/campaign-actions";

// The side panel the Campaigns list opens: one campaign's placements, each
// with its artwork, link, on/off and numbers, so the everyday jobs (swap a
// banner, fix a link, take one down, read the clicks) happen without leaving
// the list. It reads /api/campaigns/[id]/placements and changes things
// through the same server actions as the campaign page.

const n = (v) => (v || 0).toLocaleString("en-GB");
const ctr = (c, v) => (v ? `${((c / v) * 100).toFixed(2)}%` : "—");
const kb = (b) => (b ? `${Math.round(b / 1024)} KB` : "");
const day = (s) =>
  s ? new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "not yet";

export default function CampaignPanel({ campaignId, onClose }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, startBusy] = useTransition();
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetch(`/api/campaigns/${campaignId}/placements`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        setData(d);
        setErr("");
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  // Run an action, then re-read the panel and the list behind it.
  const act = (fn, done) =>
    startBusy(async () => {
      const res = await fn();
      if (res?.message) setNote(res.message);
      else if (done) setNote(done);
      load();
      router.refresh();
    });

  return (
    <div className="cpanel-wrap" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="cpanel" role="dialog" aria-modal="true" aria-label={data ? `${data.advertiser} placements` : "Campaign"}>
        <header className="cpanel-head">
          <div>
            <span className="micro" style={{ color: "var(--muted)" }}>
              {data?.name || "Loading…"}
            </span>
            <h2>{data?.advertiser || " "}</h2>
          </div>
          <button type="button" className="cpanel-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {err && <p className="micro" style={{ color: "var(--neon-amber)" }}>Could not load this campaign ({err}).</p>}

        {data && (
          <>
            <div className="cpanel-bar">
              <span className="micro" style={{ color: "var(--muted)" }}>
                Numbers last copied from the sites: {when(data.lastCounted)}
              </span>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => act(() => refreshCampaignStats(data.id))}>
                {busy ? "Working…" : "Update numbers now"}
              </button>
              <Link className="btn-ghost" href={`/campaigns/${data.id}`}>
                Full campaign →
              </Link>
            </div>
            {note && <p className="micro cpanel-note">{note}</p>}

            {data.placements.length === 0 && (
              <p className="micro" style={{ color: "var(--muted)" }}>
                No placements on the sites yet. Book them from the month grid on the full campaign page.
              </p>
            )}

            {data.placements.map((p) => {
              const live = p.creatives.filter((c) => c.active);
              const off = p.creatives.filter((c) => !c.active);
              const max = Math.max(1, ...p.days.map((d) => d.views));
              return (
                <section key={p.id} className="cpl">
                  <header className="cpl-head">
                    <div>
                      <strong>
                        {p.label}
                        {p.site ? `, ${p.site.name}` : ""}
                      </strong>
                      <span className="micro" style={{ color: "var(--muted)", display: "block" }}>
                        {p.run ? `${day(p.run.start)} to ${day(p.run.end)}` : "No dates"}
                        {p.size ? ` · ${p.size[0]}×${p.size[1]}` : ""}
                      </span>
                    </div>
                    <span className={`chip ${p.stateChip}`}>{p.stateLabel}</span>
                  </header>

                  {/* Numbers first: it is the question asked most. */}
                  {p.email ? (
                    <div className="cpl-stats">
                      <div>
                        <b>{n(p.stats.served)}</b>
                        <span>Sent</span>
                      </div>
                      <div>
                        <b>{n(p.stats.views)}</b>
                        <span>Opens</span>
                      </div>
                      <div>
                        <b>{n(p.stats.clicks)}</b>
                        <span>Clicks</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="cpl-stats">
                        <div>
                          <b>{n(p.stats.views)}</b>
                          <span>Impressions</span>
                        </div>
                        <div>
                          <b>{n(p.stats.clicks)}</b>
                          <span>Clicks</span>
                        </div>
                        <div>
                          <b>{ctr(p.stats.clicks, p.stats.views)}</b>
                          <span>Click-through</span>
                        </div>
                      </div>
                      <div className="cpl-spark" aria-label="Impressions per day, last 30 days">
                        {p.days.map((d) => (
                          <span
                            key={d.day}
                            title={`${day(d.day)}: ${n(d.views)} impressions, ${n(d.clicks)} clicks`}
                            style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }}
                            className={d.clicks ? "has-click" : ""}
                          />
                        ))}
                      </div>
                      <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
                        Last 30 days. An impression is half the banner on screen for a second, counted by the site.
                      </p>
                    </>
                  )}

                  {/* Artwork */}
                  {p.size && (
                    <div className="cpl-art">
                      {live.length === 0 && (
                        <p className="micro" style={{ color: "var(--neon-amber)", margin: 0 }}>
                          No artwork running. Upload some below.
                        </p>
                      )}
                      {[...live, ...off].map((c) => (
                        <figure key={c.id} className={`cpl-cr${c.active ? "" : " is-off"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/campaign-assets/${c.id}`} alt={c.name} />
                          <figcaption className="micro">
                            <span>
                              {c.active ? "Running" : "Not running"} · {c.width}×{c.height}
                              {c.webSize ? ` · ${kb(c.webSize)}` : ""}
                            </span>
                            {!c.ok && <span style={{ color: "var(--neon-amber)" }}>⚠ {c.problems.join("; ")}</span>}
                            <span className="cpl-cr-acts">
                              <button type="button" className="btn-ghost" disabled={busy} onClick={() => act(() => setAssetActive(c.id, !c.active), c.active ? "Taken out of rotation." : "Back in rotation.")}>
                                {c.active ? "Stop showing" : "Show again"}
                              </button>
                              <button
                                type="button"
                                className="btn-ghost"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`Delete ${c.name} for good?`)) act(() => deleteAsset(c.id), "Deleted.");
                                }}
                              >
                                Delete
                              </button>
                            </span>
                          </figcaption>
                        </figure>
                      ))}
                      <div className="cpl-upload">
                        <span className="micro">Change the artwork:</span>
                        <CampaignAssetUpload
                          campaignId={data.id}
                          deliverables={[{ id: p.id, title: p.title, slot: p.size }]}
                          fixed
                          replace
                          onDone={() => {
                            load();
                            router.refresh();
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Link */}
                  {(p.served || p.position === "newsletter_banner") && (
                    <form
                      className="cpl-link"
                      action={(fd) => act(() => updatePlacement(p.id, fd), "Link saved. The site has it within seconds.")}
                    >
                      <label className="micro" htmlFor={`url-${p.id}`}>
                        Click-through link
                      </label>
                      <div className="adv-inline">
                        <input id={`url-${p.id}`} name="targetUrl" type="url" defaultValue={p.targetUrl} placeholder="https://" style={{ flex: "1 1 240px" }} />
                        <button type="submit" className="btn-ghost" disabled={busy}>
                          Save link
                        </button>
                        {p.targetUrl && (
                          <a className="btn-ghost" href={p.targetUrl} target="_blank" rel="noreferrer">
                            Test ↗
                          </a>
                        )}
                      </div>
                    </form>
                  )}

                  {/* On and off */}
                  {p.served && (
                    <div className="cpl-acts">
                      {(p.state === "live" || p.state === "scheduled") && (
                        <button
                          type="button"
                          className="btn-ghost cpl-danger"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Take ${p.label} down from ${p.site?.name || "the site"} now?`)) act(() => setPaused(p.id, true), "Taken down. Off the site within seconds.");
                          }}
                        >
                          Take down
                        </button>
                      )}
                      {p.state === "paused" && (
                        <button type="button" className="btn" disabled={busy} onClick={() => act(() => setPaused(p.id, false), "Back up on the site.")}>
                          Put back up
                        </button>
                      )}
                      {p.site?.domain && (
                        <a className="btn-ghost" href={`https://${p.site.domain}/?cogent_ad_preview=${p.id}`} target="_blank" rel="noreferrer">
                          See it on the site ↗
                        </a>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </aside>
    </div>
  );
}
