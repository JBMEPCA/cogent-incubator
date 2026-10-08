import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import { MailSearch, MailRow } from "@/app/components/home/MailWidget";
import { listSites } from "@/lib/site";
import { fleetMail } from "@/lib/fleet-mail";
import { canEdit } from "@/lib/permissions";
import MarkAllRead from "@/app/components/home/MarkAllRead";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mail worth reading" };

// The full mailbox behind the home page widget: every title's mail worth
// reading, searchable, and filterable to unread or backlink replies.

const FILTERS = [
  { key: "", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "backlink", label: "Backlink replies" },
];

export default async function MailPage({ searchParams }) {
  const { q = "", show = "" } = await searchParams;
  const sites = await listSites();
  const [{ items, unavailable }, editable] = await Promise.all([
    fleetMail(sites, { perSite: 40 }),
    canEdit().catch(() => false),
  ]);

  const needle = String(q).trim().toLowerCase();
  const shown = items.filter((m) => {
    if (show === "unread" && !m.unread) return false;
    if (show === "backlink" && m.kind !== "backlink") return false;
    if (!needle) return true;
    return [m.fromParsed.name, m.fromParsed.email, m.subject, m.site.name]
      .filter(Boolean)
      .some((s) => s.toLowerCase().includes(needle));
  });

  const href = (key) => {
    const p = new URLSearchParams();
    if (needle) p.set("q", q);
    if (key) p.set("show", key);
    const s = p.toString();
    return s ? `/mail?${s}` : "/mail";
  };

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Mail worth reading</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>

      <section className="dw dw-mail dw-page">
        <MailSearch q={q} />
        <nav className="dw-filters" aria-label="Filter mail">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href(f.key)} className="dw-filter" aria-current={show === f.key ? "page" : undefined}>
              {f.label}
            </Link>
          ))}
          {editable && <MarkAllRead unread={items.filter((m) => m.unread).length} />}
          <span className="dw-muted">
            {shown.length} message{shown.length === 1 ? "" : "s"}
            {needle ? ` matching “${q}”` : ""}
          </span>
        </nav>
        {shown.length ? (
          <div className="dw-mlist">
            {shown.map((m) => (
              <MailRow key={`${m.site.slug}-${m.id}`} m={m} />
            ))}
          </div>
        ) : (
          <p className="dw-note">Nothing here.</p>
        )}
        {unavailable.length > 0 && <p className="dw-note">Mailbox not readable for {unavailable.join(", ")}.</p>}
      </section>
    </main>
  );
}
