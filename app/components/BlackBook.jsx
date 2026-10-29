import { prisma } from "@/lib/prisma";
import { dueFirst, isDue } from "@/lib/black-book-labels";
import BlackBookForm from "./BlackBookForm";
import BlackBookList from "./BlackBookList";

// The Black Book on the fleet overview: advertising contacts (mostly agencies
// asking for a media pack) kept so someone can come back to them later.
// Entered by hand; see BlackBookContact in the schema for why it is fleet-wide.

// Outside the component so the follow-up check is data, not render logic.
async function loadContacts() {
  const rows = await prisma.blackBookContact.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  // Dates go to client rows, so they travel as ISO strings.
  return dueFirst(rows, now).map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    followUpDate: c.followUpDate ? c.followUpDate.toISOString() : null,
    due: isDue(c.followUpDate, now),
  }));
}

// The names the sales person box suggests: everyone already allocated, plus
// the dashboard's accounts. Free text still works for someone new.
async function loadSalesPeople(contacts) {
  const users = await prisma.user.findMany({ select: { name: true } }).catch(() => []);
  const names = [...contacts.map((c) => c.salesPerson), ...users.map((u) => u.name)];
  return [...new Set(names.filter(Boolean).map((n) => n.trim()))].sort((a, b) => a.localeCompare(b));
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
  const suggested = await loadSalesPeople(contacts);
  // The filter offers only people who actually have contacts.
  const allocated = [...new Set(contacts.map((c) => c.salesPerson).filter(Boolean))].sort((a, b) => a.localeCompare(b));

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

      {/* Shared by the add form and every row's edit form. */}
      <datalist id="bb-sales-people">
        {suggested.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {unavailable ? (
        <p className="field-err">The Black Book table isn&apos;t in the database yet.</p>
      ) : (
        <BlackBookForm sites={pillSites} />
      )}

      {contacts.length > 0 && <BlackBookList contacts={contacts} sites={pillSites} salesPeople={allocated} />}
    </section>
  );
}
