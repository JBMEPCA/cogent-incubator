import { prisma } from "@/lib/prisma";
import BlackBookForm from "./BlackBookForm";
import BlackBookRow from "./BlackBookRow";

// The Black Book on the fleet overview: advertising contacts (mostly agencies
// asking for a media pack) kept so someone can come back to them later.
// Entered by hand; see BlackBookContact in the schema for why it is fleet-wide.

// Outside the component so the follow-up check is data, not render logic.
async function loadContacts() {
  const rows = await prisma.blackBookContact.findMany({ orderBy: { createdAt: "desc" } });
  const now = Date.now();
  // Dates go to client rows, so they travel as ISO strings.
  return rows.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    followUpDate: c.followUpDate ? c.followUpDate.toISOString() : null,
    due: !!c.followUpDate && c.followUpDate.getTime() <= now,
  }));
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

  const pillSites = sites
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
        <BlackBookForm sites={pillSites} />
      )}

      {contacts.length > 0 && (
        <div className="bb-list">
          {contacts.map((c) => (
            <BlackBookRow key={c.id} contact={c} sites={pillSites} />
          ))}
        </div>
      )}
    </section>
  );
}
