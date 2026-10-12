import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import AdvertiserForm from "@/app/components/AdvertiserForm";
import AdvertiserImport from "@/app/components/AdvertiserImport";
import BlackBookTitlePills from "@/app/components/BlackBookTitlePills";
import ConfirmSubmit from "@/app/components/ConfirmSubmit";
import { prisma, fleetRead } from "@/lib/prisma";
import { listSites } from "@/lib/site";
import { shortTitle } from "@/lib/black-book-labels";
import { normaliseDomain } from "@/lib/advertiser-csv";
import { PRODUCTS, productLabel } from "@/lib/crm";
import { OUTCOMES, OFFER_REST_DAYS, editorialByDomain, optOutsFor, outcomeInfo } from "@/lib/advertisers";
import {
  addContact,
  deleteAdvertiser,
  deleteContact,
  deleteOffer,
  logOffer,
  setOfferOutcome,
  updateAdvertiser,
} from "@/lib/advertiser-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advertisers" };

const PAGE = 50;

const fmtDay = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" })
    : "—";
const isoDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
// Server-rendered per request (force-dynamic), so "now" is fixed for the render.
const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const fullName = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ");

const SHOW = [
  { value: "", label: "Everyone" },
  { value: "ready", label: "Ready for an offer" },
  { value: "contacts", label: "Has a contact" },
  { value: "nocontacts", label: "No contact yet" },
  { value: "offered", label: "Offered before" },
];

/**
 * Where a brand stands for the next mail merge, in one word. The order is the
 * order of precedence: an opt-out beats everything, an open editorial
 * conversation beats a free slot.
 */
function standing(a, { optedOut, editorial }) {
  if (optedOut) return { label: "Opted out", chip: "chip-monetise", why: `Opted out ${fmtDay(optedOut)}` };
  if (editorial?.open) return { label: "Editorial open", chip: "chip-content", why: `${editorial.what} conversation in progress` };
  const last = a.offers[0];
  if (last) {
    const until = new Date(last.sentAt.getTime() + OFFER_REST_DAYS * 864e5);
    if (until > new Date()) return { label: "Resting", chip: "chip-general", why: `Next offer from ${fmtDay(until)}` };
  }
  if (!a.contacts.length) return { label: "No contact", chip: "chip-general", why: "Needs a marketing contact" };
  return { label: "Ready", chip: "chip-audience", why: "Can be offered" };
}

export default async function AdvertisersPage({ searchParams }) {
  const sp = await searchParams;
  const sites = await listSites();
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const title = sites.find((s) => s.slug === sp.title) || null;
  const q = (sp.q || "").toString().trim();
  const show = SHOW.some((s) => s.value === sp.show) ? sp.show : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const restSince = daysAgo(OFFER_REST_DAYS);
  const and = [];
  if (title) and.push({ OR: [{ siteIds: { has: title.id } }, { siteIds: { isEmpty: true } }] });
  if (q) {
    and.push({
      OR: [
        { company: { contains: q, mode: "insensitive" } },
        { domain: { contains: q.toLowerCase() } },
        { category: { contains: q, mode: "insensitive" } },
        { contacts: { some: { email: { contains: q.toLowerCase() } } } },
      ],
    });
  }
  if (show === "contacts") and.push({ contacts: { some: {} } });
  if (show === "nocontacts") and.push({ contacts: { none: {} } });
  if (show === "offered") and.push({ offers: { some: {} } });
  // "Ready" is finished below, because the opt-out and editorial checks are
  // not in this table; the query narrows to what it can.
  if (show === "ready") and.push({ contacts: { some: {} } }, { offers: { none: { sentAt: { gte: restSince } } } });
  const where = and.length ? { AND: and } : {};

  const [total, advertisers, stats, prospects] = await Promise.all([
    prisma.advertiser.count({ where }),
    prisma.advertiser.findMany({
      where,
      orderBy: [{ company: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        offers: { orderBy: { sentAt: "desc" }, take: 6, include: { contact: { select: { email: true } } } },
      },
    }),
    Promise.all([
      prisma.advertiser.count(),
      prisma.advertiserContact.count(),
      prisma.advertiser.count({ where: { offers: { some: { sentAt: { gte: restSince } } } } }),
      prisma.advertiserOffer.count({ where: { outcome: { in: ["replied", "handed_over"] } } }),
    ]),
    fleetRead().advertiserProspect.findMany({ select: { website: true } }),
  ]);
  const [brandCount, contactCount, resting, replies] = stats;

  const domains = advertisers.map((a) => a.domain);
  const [editorial, optOuts] = await Promise.all([editorialByDomain(domains), optOutsFor(domains)]);

  // Research-list rows that would still add something if pulled in.
  const researchDomains = [...new Set(prospects.map((p) => normaliseDomain(p.website)).filter(Boolean))];
  const alreadyListed = researchDomains.length
    ? await prisma.advertiser.count({ where: { domain: { in: researchDomains } } })
    : 0;
  const researchCount = researchDomains.length - alreadyListed;

  const categories = (
    await prisma.advertiser.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } })
  ).map((r) => r.category);

  let rows = advertisers.map((a) => ({
    a,
    st: standing(a, { optedOut: optOuts.get(a.domain), editorial: editorial.get(a.domain) }),
    ed: editorial.get(a.domain),
  }));
  if (show === "ready") rows = rows.filter((r) => r.st.label === "Ready");

  const qs = (over) => {
    const p = new URLSearchParams();
    const merged = { title: title?.slug, q, show, page: String(page), ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Advertisers</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Brands we sell to</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 640 }}>
                One list for every title, one row per company. A brand rests for {OFFER_REST_DAYS / 7} weeks after an
                offer, and is held back while an interview or backlink conversation with it is open. People who asked
                us about advertising are in the{" "}
                <Link href="/black-book" style={{ color: "var(--neon-cyan)" }}>
                  Black Book
                </Link>
                .
              </p>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Brands", value: brandCount },
                { label: "Contacts", value: contactCount },
                { label: "Resting", value: resting },
                { label: "Replies", value: replies },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <details className="panel stagger adv-panel" style={{ marginBottom: 18 }}>
          <summary>
            <h2>Import a CSV</h2>
          </summary>
          <AdvertiserImport sites={sites} researchCount={researchCount} />
        </details>

        <details className="panel stagger adv-panel" style={{ marginBottom: 24 }}>
          <summary>
            <h2>Add one by hand</h2>
          </summary>
          <AdvertiserForm sites={sites} categories={categories} />
        </details>

        <section className="panel stagger">
          <form method="get" className="adv-filters">
            <select name="title" defaultValue={title?.slug || ""} aria-label="Title">
              <option value="">All titles</option>
              {sites.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="show" defaultValue={show} aria-label="Show">
              {SHOW.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input name="q" defaultValue={q} placeholder="Search company, domain, category, email" style={{ flex: "1 1 220px" }} />
            <button type="submit" className="btn">
              Filter
            </button>
            <a
              className="btn-ghost"
              href={`/api/advertisers${title ? `?title=${title.slug}` : ""}`}
              title="One row per contact. Brands that opted out are left off."
            >
              Export CSV{title ? ` (${shortTitle(title.name).label})` : ""}
            </a>
          </form>

          <p className="micro" style={{ color: "var(--muted)", margin: "12px 0 6px" }}>
            {total} brand{total === 1 ? "" : "s"}
            {show === "ready" ? `, ${rows.length} ready on this page` : ""}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>

          {rows.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              {brandCount === 0 ? "No advertisers yet. Import a CSV or add one by hand above." : "Nothing matches that filter."}
            </p>
          ) : (
            <div className="adv-list">
              <div className="adv-sum adv-sum-head micro" aria-hidden="true">
                <span>Brand</span>
                <span>Titles</span>
                <span>Contacts</span>
                <span>Editorial</span>
                <span>Last offer</span>
                <span>Status</span>
              </div>
              {rows.map(({ a, st, ed }) => (
                <AdvertiserRow key={a.id} a={a} st={st} ed={ed} sites={sites} siteById={siteById} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="bb-actions" style={{ marginTop: 16 }}>
              {page > 1 && (
                <Link className="btn-ghost" href={`/advertisers${qs({ page: String(page - 1) })}`}>
                  ← Previous
                </Link>
              )}
              {page < pages && (
                <Link className="btn-ghost" href={`/advertisers${qs({ page: String(page + 1) })}`}>
                  Next →
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TitlePills({ ids, siteById }) {
  if (!ids.length) return <span className="adv-pill">🌍 All</span>;
  return ids.map((id) => {
    const s = siteById.get(id);
    if (!s) return null;
    const t = shortTitle(s.name);
    return (
      <span key={id} className="adv-pill" title={s.name}>
        {t.emoji} {t.label}
      </span>
    );
  });
}

function AdvertiserRow({ a, st, ed, sites, siteById }) {
  const first = a.contacts[0];
  const last = a.offers[0];
  const offerSites = a.siteIds.length ? sites.filter((s) => a.siteIds.includes(s.id)) : sites;

  return (
    <details className="adv-row">
      <summary className="adv-sum">
        <span className="adv-brand">
          <strong>{a.company}</strong>
          <span className="micro" style={{ color: "var(--muted)" }}>
            {a.domain}
            {a.category ? ` · ${a.category}` : ""}
          </span>
        </span>
        <span className="adv-pills">
          <TitlePills ids={a.siteIds} siteById={siteById} />
        </span>
        <span>
          {first ? (
            <>
              {fullName(first) || first.email}
              <span className="micro" style={{ color: "var(--muted)", display: "block" }}>
                {first.jobTitle || first.email}
                {a.contacts.length > 1 ? ` · +${a.contacts.length - 1} more` : ""}
              </span>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>—</span>
          )}
        </span>
        <span>
          {ed?.lastAt ? (
            <>
              {fmtDay(ed.lastAt)}
              <span className="micro" style={{ color: "var(--muted)", display: "block" }}>{ed.what}</span>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>—</span>
          )}
        </span>
        <span>
          {last ? (
            <>
              {fmtDay(last.sentAt)}
              <span className="micro" style={{ color: "var(--muted)", display: "block" }}>{last.campaign}</span>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>Never</span>
          )}
        </span>
        <span title={st.why}>
          <span className={`chip ${st.chip}`}>{st.label}</span>
        </span>
      </summary>

      <div className="adv-body">
        <p className="micro" style={{ margin: 0, color: "var(--muted)" }}>
          {st.why}.{" "}
          {a.website && (
            <a href={/^https?:/i.test(a.website) ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" style={{ color: "var(--neon-cyan)" }}>
              Website ↗
            </a>
          )}
          {a.sourceDetail ? ` · From: ${a.sourceDetail}` : ""}
          {` · Added ${fmtDay(a.createdAt)}`}
        </p>
        {a.notes && <p className="bb-notes">{a.notes}</p>}

        {/* Contacts */}
        <h3>Contacts</h3>
        {a.contacts.length > 0 && (
          <table className="adv-table">
            <tbody>
              {a.contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{fullName(c) || "—"}</strong>
                    {c.jobTitle && <span className="micro" style={{ color: "var(--muted)", display: "block" }}>{c.jobTitle}</span>}
                  </td>
                  <td>
                    <a href={`mailto:${c.email}`} style={{ color: "var(--neon-cyan)" }}>{c.email}</a>
                    {c.verifyStatus && <span className="micro" style={{ marginLeft: 8 }}>{c.verifyStatus}</span>}
                  </td>
                  <td className="micro">{c.phone || ""}</td>
                  <td style={{ textAlign: "right" }}>
                    <ConfirmSubmit action={deleteContact.bind(null, c.id)} question={`Remove ${c.email}?`} label="✕" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addContact.bind(null, a.id)} className="adv-inline">
          <input name="email" type="email" required placeholder="email@" style={{ flex: "2 1 200px" }} />
          <input name="firstName" placeholder="First name" style={{ flex: "1 1 110px" }} />
          <input name="lastName" placeholder="Last name" style={{ flex: "1 1 110px" }} />
          <input name="jobTitle" placeholder="Job title" style={{ flex: "1 1 140px" }} />
          <button type="submit" className="btn-ghost">Add contact</button>
        </form>

        {/* Offers */}
        <h3>Offers</h3>
        {a.offers.length > 0 && (
          <table className="adv-table">
            <tbody>
              {a.offers.map((o) => {
                const s = o.siteId ? siteById.get(o.siteId) : null;
                return (
                  <tr key={o.id}>
                    <td>{fmtDay(o.sentAt)}</td>
                    <td>
                      <strong>{o.campaign}</strong>
                      <span className="micro" style={{ color: "var(--muted)", display: "block" }}>
                        {[s && shortTitle(s.name).label, o.product && productLabel(o.product), o.contact?.email].filter(Boolean).join(" · ")}
                      </span>
                      {o.hook && <span className="micro" style={{ display: "block" }}>{o.hook}</span>}
                    </td>
                    <td>
                      <form action={setOfferOutcome.bind(null, o.id)} className="adv-inline" style={{ margin: 0 }}>
                        <select name="outcome" defaultValue={o.outcome} aria-label="Outcome">
                          {OUTCOMES.map((x) => (
                            <option key={x.value} value={x.value}>{x.label}</option>
                          ))}
                        </select>
                        <button type="submit" className="btn-ghost">Save</button>
                      </form>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`chip ${outcomeInfo(o.outcome).chip}`} style={{ marginRight: 8 }}>{outcomeInfo(o.outcome).label}</span>
                      <ConfirmSubmit action={deleteOffer.bind(null, o.id)} question="Delete this offer from the record?" label="✕" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <form action={logOffer.bind(null, a.id)} className="adv-inline">
          <input name="campaign" placeholder="Campaign, e.g. October e-shot" style={{ flex: "2 1 180px" }} />
          <select name="siteId" defaultValue="" aria-label="Title">
            <option value="">Title…</option>
            {offerSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select name="product" defaultValue="" aria-label="Product">
            <option value="">Product…</option>
            {PRODUCTS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {a.contacts.length > 0 && (
            <select name="contactId" defaultValue={first.id} aria-label="Sent to">
              {a.contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.email}</option>
              ))}
            </select>
          )}
          <input name="hook" placeholder="Hook, e.g. free web story" style={{ flex: "2 1 180px" }} />
          <input name="sentAt" type="date" defaultValue={isoDay(new Date())} aria-label="Sent on" />
          <button type="submit" className="btn-ghost">Log offer sent</button>
        </form>

        {/* Details */}
        <h3>Details</h3>
        <form action={updateAdvertiser.bind(null, a.id)} className="bb-form">
          <label className="field">
            <span className="micro">Company</span>
            <input name="company" required defaultValue={a.company} />
          </label>
          <label className="field">
            <span className="micro">Website</span>
            <input name="website" defaultValue={a.website || ""} />
          </label>
          <label className="field">
            <span className="micro">Category</span>
            <input name="category" defaultValue={a.category || ""} />
          </label>
          <label className="field">
            <span className="micro">Notes</span>
            <input name="notes" defaultValue={a.notes || ""} />
          </label>
          <BlackBookTitlePills sites={sites} selected={a.siteIds} />
          <div className="field-wide bb-actions">
            <button type="submit" className="btn">Save details</button>
          </div>
        </form>
        {/* Outside the details form: a form inside a form is invalid HTML and
            breaks hydration for the whole page. */}
        <div>
          <ConfirmSubmit
            action={deleteAdvertiser.bind(null, a.id)}
            question={`Delete ${a.company}, its contacts and its offer history?`}
            label="Delete brand"
          />
        </div>
      </div>
    </details>
  );
}
