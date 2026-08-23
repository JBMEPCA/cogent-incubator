import Link from "next/link";
import { getSiteContext } from "@/lib/site";
import { noteworthyMail } from "@/lib/mail-triage";

// Mail worth reading, across every title's mailbox, on the fleet dashboard.
//
// Async server component so the fleet page itself only places it. It shows
// backlink replies and mail that looks like a person wrote it, and swallows
// the marketing, notification and auto-reply noise those inboxes mostly hold.
// A mailbox that cannot be read degrades to one quiet line, never an error.

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default async function FleetMailWidget({ sites, max = 10 }) {
  const perSite = await Promise.all(
    sites.map(async (s) => {
      try {
        const ctx = await getSiteContext(s.slug);
        if (!ctx) return null;
        return await noteworthyMail(ctx.site, ctx.creds, ctx.db);
      } catch {
        return null;
      }
    })
  );

  const unavailable = [];
  const items = [];
  perSite.forEach((r, i) => {
    if (!r) return;
    if (!r.available) unavailable.push(sites[i].name);
    else items.push(...r.items);
  });
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const shown = items.slice(0, max);

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Mail worth reading</h2>
        <span className="micro" style={{ color: "var(--muted)" }}>
          every title&apos;s inbox, minus the marketing and the machines
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="micro" style={{ color: "var(--muted)", margin: "8px 0 0" }}>
          Nothing needing attention.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {shown.map((m) => (
            <Link
              key={`${m.site.slug}-${m.id}`}
              href={`/s/${m.site.slug}/mail/${m.id}`}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "baseline",
                flexWrap: "wrap",
                textDecoration: "none",
                color: "inherit",
                borderTop: "1px solid var(--line)",
                paddingTop: 8,
              }}
            >
              <span className="chip chip-general">{m.site.name}</span>
              {m.kind === "backlink" && <span className="chip chip-audience">backlink reply</span>}
              <strong style={{ fontSize: 13, fontWeight: m.unread ? 700 : 500 }}>
                {m.fromParsed.name}
              </strong>
              <span style={{ fontSize: 13 }}>{m.subject}</span>
              <span className="micro" style={{ color: "var(--muted)", marginLeft: "auto" }}>
                {fmt(m.date)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <p className="micro" style={{ color: "var(--muted)", margin: "10px 0 0" }}>
          Mailbox not readable for {unavailable.join(", ")}.
        </p>
      )}
    </section>
  );
}
