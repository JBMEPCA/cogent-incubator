import ConfirmSubmit from "@/app/components/ConfirmSubmit";
import { LIVE_LABEL, liveState, runDays } from "@/lib/ads";
import { checkCreative, positionInfo } from "@/lib/ad-positions";
import { ctr, fmtBytes } from "@/lib/campaigns";
import { setAssetActive, setPaused, updatePlacement } from "@/lib/campaign-actions";
import { shortTitle } from "@/lib/black-book-labels";

// The placements the sites serve or the newsletters carry, with the controls
// that change what readers see: the click-through URL, the artwork in
// rotation, and take down / put back. Every change pushes to the site at once
// (lib/ads.js refreshSite), so what this panel says is what the site shows
// within seconds.

const fmtDay = (s) =>
  s ? new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const n = (v) => (v ? v.toLocaleString("en-GB") : "0");

export default function Placements({ deliverables, sitesById, statsById, now }) {
  const rows = deliverables.filter((d) => d.position);
  if (!rows.length) return null;
  return (
    <div className="pl-list">
      {rows.map((d) => {
        const info = positionInfo(d.position);
        const state = liveState(d, now);
        const lbl = LIVE_LABEL[state];
        const run = runDays(d);
        const site = d.siteId ? sitesById.get(d.siteId) : null;
        const t = site ? shortTitle(site.name) : null;
        const s = statsById.get(d.id) || { served: 0, views: 0, clicks: 0 };
        const creatives = d.assets.filter((a) => !a.url && a.width);
        const inRotation = creatives.filter((a) => a.active);
        const previewable = info.served && site?.domain;
        return (
          <article key={d.id} className="plc">
            <header className="plc-head">
              <div>
                <strong>{info.label}</strong>
                <span className="micro" style={{ color: "var(--muted)", display: "block" }}>
                  {t ? `${t.emoji} ${site.name}` : "No title set"} · {run ? `${fmtDay(run.start)} to ${fmtDay(run.end)}` : "no dates"}
                </span>
              </div>
              <div className="plc-actions">
                <span className={`chip ${lbl.chip}`}>{lbl.label}</span>
                {info.served && inRotation.length === 0 && state !== "ended" && <span className="chip chip-monetise">No artwork live</span>}
                {previewable && (
                  <a className="btn-ghost" href={`https://${site.domain}/?cogent_ad_preview=${d.id}`} target="_blank" rel="noreferrer">
                    Preview on site ↗
                  </a>
                )}
                {(state === "live" || state === "scheduled") && (
                  <ConfirmSubmit action={setPaused.bind(null, d.id, true)} question={`Take ${info.label} down from ${site?.name || "the site"} now?`} label="Take down" />
                )}
                {state === "paused" && (
                  <form action={setPaused.bind(null, d.id, false)} style={{ display: "inline" }}>
                    <button type="submit" className="btn-ghost" style={{ color: "var(--neon-green)" }}>
                      Put back up
                    </button>
                  </form>
                )}
              </div>
            </header>

            <form action={updatePlacement.bind(null, d.id)} className="adv-inline">
              <input
                name="targetUrl"
                type="url"
                defaultValue={d.targetUrl || ""}
                placeholder="Click-through URL, e.g. https://www.miele.co.uk/professional"
                style={{ flex: "3 1 280px" }}
                aria-label="Click-through URL"
              />
              <input name="dueDate" type="date" defaultValue={run?.start || ""} aria-label="Starts" title="Starts" />
              {info.served && <input name="runUntil" type="date" defaultValue={run?.end || ""} aria-label="Ends" title="Ends" />}
              {info.email && (
                <input
                  name="mailchimpCampaignId"
                  defaultValue={d.mailchimpCampaignId || ""}
                  placeholder="Mailchimp campaign id"
                  title="Filled in automatically for newsletter banners; for a solus, paste the id from the Mailchimp campaign's URL"
                  style={{ flex: "1 1 160px" }}
                />
              )}
              <button type="submit" className="btn-ghost">
                Save
              </button>
            </form>

            {info.size && (
              <div className="plc-creatives">
                {creatives.length === 0 && (
                  <p className="micro" style={{ color: "var(--neon-amber)", margin: 0 }}>
                    No artwork yet. Upload it below and pick this placement: {info.size[0]}×{info.size[1]}
                    {info.maxKb ? `, under ${info.maxKb} KB` : ""}.
                  </p>
                )}
                {creatives.map((a) => {
                  const c = checkCreative(d.position, { width: a.width, height: a.height, mimeType: a.webMime || a.mimeType, webBytes: a.webSize });
                  return (
                    <figure key={a.id} className={`plc-cr${a.active ? "" : " is-off"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/campaign-assets/${a.id}`} alt={a.name} loading="lazy" style={{ aspectRatio: `${a.width} / ${a.height}` }} />
                      <figcaption className="micro">
                        <span className={c.ok ? "plc-ok" : "plc-bad"}>{c.ok ? "✓ Meets spec" : `⚠ ${c.problems.join("; ")}`}</span>
                        <span style={{ color: "var(--muted)" }}>
                          {a.width}×{a.height}
                          {a.webSize ? ` · serves at ${fmtBytes(a.webSize)}` : ""}
                        </span>
                        <form action={setAssetActive.bind(null, a.id, !a.active)} style={{ display: "inline" }}>
                          <button type="submit" className="btn-ghost" style={{ padding: 0 }}>
                            {a.active ? "In rotation · take out" : "Out of rotation · put in"}
                          </button>
                        </form>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}

            <footer className="plc-stats micro">
              {info.email ? (
                <>
                  <span>
                    Sent <b>{n(s.served)}</b>
                  </span>
                  <span>
                    Opens <b>{n(s.views)}</b>
                  </span>
                  <span>
                    Clicks <b>{n(s.clicks)}</b>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Views <b>{n(s.views)}</b>
                  </span>
                  <span>
                    Clicks <b>{n(s.clicks)}</b>
                  </span>
                  <span>
                    CTR <b>{ctr(s.clicks, s.views) || "—"}</b>
                  </span>
                </>
              )}
              <span style={{ marginLeft: "auto", color: "var(--muted)" }}>Counted on the site, updated nightly</span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
