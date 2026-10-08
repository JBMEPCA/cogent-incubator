import { prisma } from "@/lib/prisma";
import { shortTitle } from "@/lib/black-book-labels";
import { Widget, WidgetNote } from "./Widget";
import BlackBookQuickAdd from "./BlackBookQuickAdd";

// The Black Book as a widget: add someone in a few seconds, see who is due a
// follow-up, and open the full book for everything else (notes, editing,
// export). The full book is the same component the home page used to show.

const due = (c) => !!c.followUpDate && c.followUpDate.getTime() <= Date.now();

const fmtDay = (d) =>
  d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

// Every contact, in a list that scrolls inside the card (same as the mailbox
// beside it); due follow-ups first.
export default async function BlackBookWidget({ sites }) {
  let contacts = null;
  try {
    contacts = await prisma.blackBookContact.findMany({ orderBy: { createdAt: "desc" } });
  } catch {
    contacts = null;
  }

  const pillSites = sites.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
  const byId = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  // Follow-ups that are due come first: that is what someone opening the
  // dashboard can act on. Then the newest additions.
  const shown = contacts
    ? [...contacts.filter(due), ...contacts.filter((c) => !due(c))]
    : [];
  const dueCount = contacts ? contacts.filter(due).length : 0;

  return (
    <Widget
      span={6}
      className="dw-light dw-bb"
      title={
        <>
          <span className="dw-bb-badge" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5h11.5v17H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
              <path d="M8 3.5v17" />
              <path d="M11 8.5h4" />
            </svg>
          </span>
          Black Book
        </>
      }
      sub="agencies and advertisers worth coming back to"
      href="/black-book"
      linkLabel={contacts?.length ? `Open all ${contacts.length}` : "Open page"}
    >
      {contacts === null ? (
        <WidgetNote>The Black Book table isn&apos;t in the database yet.</WidgetNote>
      ) : (
        <>
          <BlackBookQuickAdd sites={pillSites} />
          {shown.length > 0 && (
            <div className="dw-bb-list dw-list-fill">
              {dueCount > 0 && (
                <p className="dw-bb-due-line">
                  {dueCount} follow-up{dueCount > 1 ? "s" : ""} due
                </p>
              )}
              {shown.map((c) => {
                const titles = c.siteIds.length
                  ? c.siteIds.map((id) => shortTitle(byId[id] || "").label).join(", ")
                  : "All titles";
                return (
                  <a key={c.id} href={`/black-book#c-${c.id}`} className="dw-bb-row">
                    <span>
                      <b>{c.company}</b>
                      <span className="dw-bb-who">
                        {c.name || c.email} · {titles}
                      </span>
                    </span>
                    {due(c) ? (
                      <span className="dw-due">Follow up due</span>
                    ) : c.followUpDate ? (
                      <span className="dw-chip">{fmtDay(c.followUpDate)}</span>
                    ) : (
                      <span className="dw-chip">Added {fmtDay(c.createdAt)}</span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </>
      )}
    </Widget>
  );
}
