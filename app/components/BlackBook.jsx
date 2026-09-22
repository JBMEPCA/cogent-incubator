import { prisma } from "@/lib/prisma";
import BlackBookForm from "./BlackBookForm";
import BlackBookDelete from "./BlackBookDelete";
import { shortTitle } from "@/lib/black-book-labels";

// The Black Book on the fleet overview: advertising contacts (mostly agencies
// asking for a media pack) kept so someone can come back to them later.
// Entered by hand; see BlackBookContact in the schema for why it is fleet-wide.

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

// Outside the component so the follow-up check is data, not render logic.
async function loadContacts() {
  const rows = await prisma.blackBookContact.findMany({ orderBy: { createdAt: "desc" } });
  const now = Date.now();
  return rows.map((c) => ({ ...c, due: !!c.followUpDate && c.followUpDate.getTime() <= now }));
}

export default async function BlackBook({ sites }) {
  let contacts = [];
  let unavailable = false;
  try {
    contacts = await loadContacts();
  } catch {
    // Table not migrated yet. The rest of the overview must still render.
    unavailable = true;
  }

  const names = new Map(sites.map((s) => [s.id, s.name]));

  return (
    <section className="panel" style={{ marginTop: 24 }} id="black-book">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Black Book</h2>
        <span className="micro" style={{ color: "var(--muted)" }}>
          agencies and advertisers worth coming back to
        </span>
        {contacts.length > 0 && (
          <a className="micro" href="/api/black-book" style={{ marginLeft: "auto" }}>
            Export CSV ({contacts.length})
          </a>
        )}
      </div>

      {unavailable ? (
        <p className="field-err">The Black Book table isn&apos;t in the database yet.</p>
      ) : (
        <BlackBookForm
          sites={sites
            .map((s) => ({ id: s.id, name: s.name }))
            .sort((a, b) => a.name.localeCompare(b.name))}
        />
      )}

      {contacts.length > 0 && (
        <div className="bb-list">
          {contacts.map((c) => {
            return (
              <div key={c.id} className="bb-row">
                <div className="bb-who">
                  <strong>{c.company}</strong>
                  <span className="micro">
                    {c.name ? `${c.name} · ` : ""}
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                  </span>
                </div>
                <div className="bb-tags">
                  {c.siteIds.length === 0 ? (
                    <span className="chip chip-brand">🌍 All titles</span>
                  ) : (
                    c.siteIds.map((id) => (
                      <span key={id} className="chip chip-general">
                        {names.has(id) ? `${shortTitle(names.get(id)).emoji} ${shortTitle(names.get(id)).label}` : "Removed title"}
                      </span>
                    ))
                  )}
                </div>
                {c.notes && <p className="bb-notes">{c.notes}</p>}
                <div className="bb-meta micro">
                  <span>added {fmtDate(c.createdAt)}</span>
                  {c.followUpDate && (
                    <span style={c.due ? { color: "var(--neon-amber)" } : undefined}>
                      {c.due ? "follow up due " : "follow up "}
                      {fmtDate(c.followUpDate)}
                    </span>
                  )}
                  <BlackBookDelete id={c.id} company={c.company} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
