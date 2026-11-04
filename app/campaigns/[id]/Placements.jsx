import ConfirmSubmit from "@/app/components/ConfirmSubmit";
import CampaignAssetUpload from "@/app/components/CampaignAssetUpload";
import { LIVE_LABEL, liveState, runDays } from "@/lib/ads";
import { POSITIONS, checkCreative, positionInfo } from "@/lib/ad-positions";
import { ctr, fmtBytes } from "@/lib/campaigns";
import { deleteDeliverable, setAssetActive, setPaused } from "@/lib/campaign-actions";
import { shortTitle } from "@/lib/black-book-labels";
import { SAVE_FORM } from "./save-form";

// The placements the sites serve or the newsletters carry, grouped by title
// and in the order the positions are sold. Each line holds everything that
// placement needs: dates, the click-through link and its artwork, uploaded
// right there. Typed fields go with the page's one Save; uploads, swaps and
// take-downs act at once, and every change reaches the site within seconds.

const fmtDay = (s) =>
  s ? new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const n = (v) => (v ? v.toLocaleString("en-GB") : "0");
const ORDER = new Map(POSITIONS.map((p, i) => [p.key, i]));

export default function Placements({ campaignId, deliverables, sitesById, statsById, now }) {
  const rows = deliverables.filter((d) => d.position);
  if (!rows.length) return null;
  const creativesOf = (d) => d.assets.filter((a) => !a.url && a.width);

  const groups = new Map();
  for (const d of rows) {
    const k = d.siteId || "";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  const titles = [...groups.keys()].sort((a, b) => (sitesById.get(a)?.name || "~").localeCompare(sitesById.get(b)?.name || "~"));

  return (
    <div className="pl-list">
      {titles.map((sid) => {
        const site = sitesById.get(sid);
        const t = site ? shortTitle(site.name) : null;
        const list = groups
          .get(sid)
          .sort((a, b) => (ORDER.get(a.position) ?? 99) - (ORDER.get(b.position) ?? 99) || (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
        return (
          <section key={sid} className="plg">
            <h3 className="plg-h">
              {t ? `${t.emoji} ${site.name}` : "No title set"}
              <span className="micro">
                {list.length} placement{list.length === 1 ? "" : "s"}
              </span>
            </h3>
            {list.map((d) => (
              <Line
                key={d.id}
                campaignId={campaignId}
                d={d}
                site={site}
                stats={statsById.get(d.id)}
                now={now}
                creatives={creativesOf(d)}
                siblings={list.filter((o) => o.id !== d.id && o.position === d.position && !creativesOf(o).some((a) => a.active)).map((o) => o.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function Line({ campaignId, d, site, stats, now, creatives, siblings }) {
  const info = positionInfo(d.position);
  const state = liveState(d, now);
  const lbl = LIVE_LABEL[state];
  const run = runDays(d);
  const s = stats || { served: 0, views: 0, clicks: 0 };
  const inRotation = creatives.filter((a) => a.active);
  const f = (k) => ({ name: `p:${d.id}:${k}`, form: SAVE_FORM });
  const hasLink = info.served || d.position === "newsletter_banner";
  return (
    <article className="plc">
      <header className="plc-head">
        <div>
          <strong>{info.label}</strong>
          <span className="micro" style={{ color: "var(--muted)", marginLeft: 8 }}>
            {run ? (run.start === run.end || !info.served ? fmtDay(run.start) : `${fmtDay(run.start)} to ${fmtDay(run.end)}`) : "no dates"}
            {info.size ? ` · ${info.size[0]}×${info.size[1]}` : ""}
          </span>
        </div>
        <div className="plc-actions">
          <span className={`chip ${lbl.chip}`}>{lbl.label}</span>
          {info.size && inRotation.length === 0 && state !== "ended" && <span className="chip chip-monetise">No artwork</span>}
          {hasLink && !d.targetUrl && state !== "ended" && <span className="chip chip-monetise">No link</span>}
          <span className="micro plc-num">
            {info.email ? (
              <>
                Sent <b>{n(s.served)}</b> · Opens <b>{n(s.views)}</b> · Clicks <b>{n(s.clicks)}</b>
              </>
            ) : (
              <>
                Views <b>{n(s.views)}</b> · Clicks <b>{n(s.clicks)}</b> · CTR <b>{ctr(s.clicks, s.views) || "—"}</b>
              </>
            )}
          </span>
        </div>
      </header>

      <div className="plc-fields">
        {hasLink && (
          <label className="field plc-url">
            <span className="micro">Click-through link</span>
            <input {...f("targetUrl")} type="url" defaultValue={d.targetUrl || ""} placeholder="https:// the advertiser's landing page" />
          </label>
        )}
        <label className="field">
          <span className="micro">{info.served ? "Starts" : "Goes out"}</span>
          <input {...f("dueDate")} type="date" defaultValue={run?.start || ""} />
        </label>
        {info.served && (
          <label className="field">
            <span className="micro">Ends</span>
            <input {...f("runUntil")} type="date" defaultValue={run?.end || ""} />
          </label>
        )}
        {info.email && (
          <label className="field">
            <span className="micro" title="Filled in automatically for newsletter banners; for a solus, paste the id from the Mailchimp campaign's URL">
              Mailchimp campaign
            </span>
            <input {...f("mailchimpCampaignId")} defaultValue={d.mailchimpCampaignId || ""} placeholder={d.position === "newsletter_banner" ? "Filled in when it sends" : "Campaign id"} />
          </label>
        )}
      </div>

      {info.size && (
        <div className="plc-art">
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
                    {a.webSize ? ` · ${fmtBytes(a.webSize)}` : ""}
                  </span>
                  <form action={setAssetActive.bind(null, a.id, !a.active)} style={{ display: "inline" }}>
                    <button type="submit" className="btn-ghost plc-mini">
                      {a.active ? "Running · stop" : "Stopped · show again"}
                    </button>
                  </form>
                </figcaption>
              </figure>
            );
          })}
          <div className="plc-up">
            <CampaignAssetUpload
              campaignId={campaignId}
              deliverables={[{ id: d.id, title: d.title, slot: info.size }]}
              fixed
              compact
              replace={inRotation.length > 0}
              also={siblings}
              alsoLabel={siblings.length ? `Also use for the other ${siblings.length} ${info.label.toLowerCase()}${siblings.length === 1 ? "" : "s"} here without artwork` : ""}
            />
            {creatives.length === 0 && (
              <span className="micro" style={{ color: "var(--muted)" }}>
                {info.size[0]}×{info.size[1]}
                {info.maxKb ? `, under ${info.maxKb} KB` : ""}. PDFs are converted.
              </span>
            )}
          </div>
        </div>
      )}

      <footer className="plc-foot">
        {info.served && site?.domain && (
          <a className="btn-ghost plc-mini" href={`https://${site.domain}/?cogent_ad_preview=${d.id}`} target="_blank" rel="noreferrer">
            Preview on site ↗
          </a>
        )}
        {info.served && (state === "live" || state === "scheduled") && (
          <ConfirmSubmit action={setPaused.bind(null, d.id, true)} question={`Take ${info.label} down from ${site?.name || "the site"} now?`} label="Take down" className="btn-ghost plc-mini" />
        )}
        {state === "paused" && (
          <form action={setPaused.bind(null, d.id, false)} style={{ display: "inline" }}>
            <button type="submit" className="btn-ghost plc-mini" style={{ color: "var(--neon-green)" }}>
              Put back up
            </button>
          </form>
        )}
        <ConfirmSubmit
          action={deleteDeliverable.bind(null, d.id)}
          question={`Remove ${info.label}${run ? ` (${fmtDay(run.start)})` : ""} from the booking? Its month goes back to being free.`}
          label="Remove from booking"
          className="btn-ghost plc-mini plc-del"
        />
      </footer>
    </article>
  );
}
