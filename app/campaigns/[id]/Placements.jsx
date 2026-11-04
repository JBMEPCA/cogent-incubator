import ConfirmSubmit from "@/app/components/ConfirmSubmit";
import CampaignAssetUpload from "@/app/components/CampaignAssetUpload";
import { LIVE_LABEL, liveState, runDays } from "@/lib/ads";
import { POSITIONS, checkCreative, positionInfo } from "@/lib/ad-positions";
import { ctr, fmtBytes } from "@/lib/campaigns";
import { deleteAsset, deleteDeliverable, setAssetActive, setPaused } from "@/lib/campaign-actions";
import { shortTitle } from "@/lib/black-book-labels";
import { SAVE_FORM } from "./save-form";

// The placements the sites serve or the newsletters carry, grouped by title
// and in the order the positions are sold. One card per position on a title,
// however many months it runs (JB, 4 Nov 2026: twelve newsletter banners are
// one thing with one link and one artwork, changed as and when). The months
// stay separate rows underneath, because each send has its own Mailchimp
// campaign and its own numbers; the card's link, artwork and take-down act
// on all of them. Typed fields go with the page's one Save; uploads, swaps
// and take-downs act at once, and reach the site within seconds.

const fmtDay = (s) =>
  s ? new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const fmtMonth = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const n = (v) => (v ? v.toLocaleString("en-GB") : "0");
const ORDER = new Map(POSITIONS.map((p, i) => [p.key, i]));
const creativesOf = (d) => d.assets.filter((a) => !a.url && a.width);
// The copies of one creative across a card's months: uploaded once, stored per month.
const sameArt = (a, b) => a.name === b.name && a.width === b.width && a.height === b.height;

export default function Placements({ campaignId, deliverables, sitesById, statsById, now }) {
  const rows = deliverables.filter((d) => d.position);
  if (!rows.length) return null;

  const bySite = new Map();
  for (const d of rows) {
    const k = d.siteId || "";
    if (!bySite.has(k)) bySite.set(k, new Map());
    const byPos = bySite.get(k);
    if (!byPos.has(d.position)) byPos.set(d.position, []);
    byPos.get(d.position).push(d);
  }
  const titles = [...bySite.keys()].sort((a, b) => (sitesById.get(a)?.name || "~").localeCompare(sitesById.get(b)?.name || "~"));

  return (
    <div className="pl-list">
      {titles.map((sid) => {
        const site = sitesById.get(sid);
        const t = site ? shortTitle(site.name) : null;
        const cards = [...bySite.get(sid).entries()]
          .sort(([a], [b]) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99))
          .map(([pos, members]) => [pos, members.sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))]);
        return (
          <section key={sid} className="plg">
            <h3 className="plg-h">
              {t ? `${t.emoji} ${site.name}` : "No title set"}
              <span className="micro">
                {cards.length} placement{cards.length === 1 ? "" : "s"}
              </span>
            </h3>
            {cards.map(([pos, members]) => (
              <Card key={pos} campaignId={campaignId} members={members} site={site} statsById={statsById} now={now} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function Card({ campaignId, members, site, statsById, now }) {
  const info = positionInfo(members[0].position);
  const states = members.map((d) => ({ d, state: liveState(d, now), run: runDays(d) }));
  // The month the card's artwork is read from: the next one still to run.
  const lead = (states.find((s) => s.state !== "ended") || states.at(-1)).d;
  const state = states.some((s) => s.state === "live")
    ? "live"
    : states.some((s) => s.state === "paused")
      ? "paused"
      : (states.find((s) => s.state !== "ended") || states.at(-1)).state;
  const lbl = LIVE_LABEL[state];
  const ids = members.map((d) => d.id);
  const single = members.length === 1;
  const run = runDays(lead);
  const stats = members.reduce(
    (a, d) => {
      const s = statsById.get(d.id) || {};
      return { served: a.served + (s.served || 0), views: a.views + (s.views || 0), clicks: a.clicks + (s.clicks || 0) };
    },
    { served: 0, views: 0, clicks: 0 }
  );
  const creatives = creativesOf(lead);
  const inRotation = creatives.filter((a) => a.active);
  const copiesOf = (a) => members.flatMap((d) => creativesOf(d).filter((b) => sameArt(a, b)).map((b) => b.id));
  const hasLink = info.served || info.key === "newsletter_banner";
  const links = new Set(members.map((d) => d.targetUrl || ""));
  const live = state === "live" || state === "scheduled";
  const f = (k) => ({ name: `p:${lead.id}:${k}`, form: SAVE_FORM });

  return (
    <article className="plc">
      <header className="plc-head">
        <div>
          <strong>{info.label}</strong>
          <span className="micro" style={{ color: "var(--muted)", marginLeft: 8 }}>
            {single
              ? run
                ? run.start === run.end || !info.served
                  ? fmtDay(run.start)
                  : `${fmtDay(run.start)} to ${fmtDay(run.end)}`
                : "no dates"
              : `${members.length} ${info.email ? "sends" : "runs"}`}
            {info.size ? ` · ${info.size[0]}×${info.size[1]}` : ""}
          </span>
        </div>
        <div className="plc-actions">
          <span className={`chip ${lbl.chip}`}>{lbl.label}</span>
          {info.size && inRotation.length === 0 && state !== "ended" && <span className="chip chip-monetise">No artwork</span>}
          {hasLink && !lead.targetUrl && state !== "ended" && <span className="chip chip-monetise">No link</span>}
          <span className="micro plc-num">
            {info.email ? (
              <>
                Sent <b>{n(stats.served)}</b> · Opens <b>{n(stats.views)}</b> · Clicks <b>{n(stats.clicks)}</b>
              </>
            ) : (
              <>
                Views <b>{n(stats.views)}</b> · Clicks <b>{n(stats.clicks)}</b> · CTR <b>{ctr(stats.clicks, stats.views) || "—"}</b>
              </>
            )}
          </span>
        </div>
      </header>

      {/* The months it runs; booked and moved in the grid above. */}
      {!single && (
        <div className="plc-months">
          {states.map(({ d, state: st, run: r }) => (
            <span key={d.id} className={`plc-month is-${st}`}>
              {r ? (info.served && r.start.slice(0, 7) !== r.end.slice(0, 7) ? `${fmtMonth(r.start)} to ${fmtMonth(r.end)}` : fmtMonth(r.start)) : "No date"}
              {info.key === "solus" && (
                <input
                  name={`p:${d.id}:mailchimpCampaignId`}
                  form={SAVE_FORM}
                  defaultValue={d.mailchimpCampaignId || ""}
                  placeholder="Mailchimp id"
                  title="Paste the id from this send's Mailchimp campaign URL, for its opens and clicks"
                />
              )}
              <ConfirmSubmit
                action={deleteDeliverable.bind(null, d.id)}
                question={`Remove ${info.label} in ${r ? fmtMonth(r.start) : "this month"} from the booking? The month goes back to being free.`}
                label="✕"
                className="plc-month-x"
              />
            </span>
          ))}
        </div>
      )}

      <div className="plc-fields">
        {hasLink && (
          <label className="field plc-url">
            <span className="micro">
              Click-through link
              {!single && links.size > 1 ? " (the months had different links; saving sets them all to this)" : ""}
            </span>
            <input
              name={single ? `p:${lead.id}:targetUrl` : `grp:${ids.join(",")}:targetUrl`}
              form={SAVE_FORM}
              type="url"
              defaultValue={lead.targetUrl || ""}
              placeholder="https:// the advertiser's landing page"
            />
          </label>
        )}
        {single && (
          <>
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
                <input {...f("mailchimpCampaignId")} defaultValue={lead.mailchimpCampaignId || ""} placeholder={info.key === "newsletter_banner" ? "Filled in when it sends" : "Campaign id"} />
              </label>
            )}
          </>
        )}
      </div>

      {info.size && (
        <div className="plc-art">
          {creatives.map((a) => {
            const c = checkCreative(info.key, { width: a.width, height: a.height, mimeType: a.webMime || a.mimeType, webBytes: a.webSize });
            const copies = copiesOf(a);
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
                  <span style={{ display: "flex", gap: 6 }}>
                    <form action={setAssetActive.bind(null, copies, !a.active)} style={{ display: "inline" }}>
                      <button type="submit" className="btn-ghost plc-mini">
                        {a.active ? "Running · stop" : "Stopped · show again"}
                      </button>
                    </form>
                    <ConfirmSubmit action={deleteAsset.bind(null, copies)} question={`Delete ${a.name}${single ? "" : ` from all ${members.length} months`}?`} label="Delete" className="btn-ghost plc-mini plc-del" />
                  </span>
                </figcaption>
              </figure>
            );
          })}
          <div className="plc-up">
            <CampaignAssetUpload
              campaignId={campaignId}
              deliverables={[{ id: lead.id, title: lead.title, slot: info.size }]}
              fixed
              compact
              replace={inRotation.length > 0}
              also={ids.filter((id) => id !== lead.id)}
              alsoAlways
            />
            <span className="micro" style={{ color: "var(--muted)" }}>
              {info.size[0]}×{info.size[1]}
              {info.maxKb ? `, under ${info.maxKb} KB` : ""}. PDFs are converted.
              {!single ? ` One upload covers all ${members.length} ${info.email ? "sends" : "runs"}${inRotation.length ? " and replaces what is running" : ""}.` : ""}
            </span>
          </div>
        </div>
      )}

      <footer className="plc-foot">
        {info.served && site?.domain && (
          <a className="btn-ghost plc-mini" href={`https://${site.domain}/?cogent_ad_preview=${lead.id}`} target="_blank" rel="noreferrer">
            Preview on site ↗
          </a>
        )}
        {info.served && live && (
          <ConfirmSubmit
            action={setPaused.bind(null, ids, true)}
            question={`Take ${info.label} down from ${site?.name || "the site"} now?`}
            label="Take down"
            className="btn-ghost plc-mini"
          />
        )}
        {state === "paused" && (
          <form action={setPaused.bind(null, ids, false)} style={{ display: "inline" }}>
            <button type="submit" className="btn-ghost plc-mini" style={{ color: "var(--neon-green)" }}>
              Put back up
            </button>
          </form>
        )}
        {single && (
          <ConfirmSubmit
            action={deleteDeliverable.bind(null, lead.id)}
            question={`Remove ${info.label}${run ? ` (${fmtDay(run.start)})` : ""} from the booking? Its month goes back to being free.`}
            label="Remove from booking"
            className="btn-ghost plc-mini plc-del"
          />
        )}
      </footer>
    </article>
  );
}
