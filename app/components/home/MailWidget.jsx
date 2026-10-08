import Link from "next/link";
import { Widget, WidgetNote } from "./Widget";
import { fleetMail, mailTime } from "@/lib/fleet-mail";
import { shortTitle } from "@/lib/black-book-labels";
import MarkAllRead from "./MarkAllRead";

// Mail worth reading, as a mailbox: search, two counts, and the newest
// messages. Every title's inbox, minus the marketing and the machines. Reading
// ten mailboxes takes a moment, so the page streams this in behind a skeleton.

export function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="#fff" />
      <path d="M4 7l8 6 8-6" fill="none" stroke="#1f7cf2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The widget shows the mail icon beside its heading, as the Black Book does,
// so the search there runs full width; the /mail page keeps it by the search.
export function MailSearch({ q = "", icon = true }) {
  return (
    <form action="/mail" className="dw-mail-top" role="search">
      {icon && (
        <span className="dw-mail-ic">
          <MailIcon />
        </span>
      )}
      <label className="dw-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <span className="sr-only">Search mail</span>
        <input type="search" name="q" defaultValue={q} placeholder="Search every title's inbox" />
      </label>
    </form>
  );
}

export function MailRow({ m }) {
  const t = shortTitle(m.site.name);
  return (
    <Link href={`/s/${m.site.slug}/mail/${m.id}`} className="dw-mrow">
      <span className={`dw-unread${m.unread ? "" : " is-read"}`} aria-label={m.unread ? "Unread" : undefined} />
      <span className={`dw-from${m.unread ? "" : " is-read"}`}>{m.fromParsed.name || m.fromParsed.email}</span>
      <span className="dw-subj">{m.subject || "(no subject)"}</span>
      <span className="dw-mmeta">
        {m.kind === "backlink" && <span className="dw-link-tag" title="Reply from a backlink contact">LINK</span>}
        <span className="dw-tchip" style={{ background: m.site.accentHex }} title={m.site.name}>
          {t.label}
        </span>
        <span className="num">{mailTime(m.date)}</span>
      </span>
    </Link>
  );
}

// Enough rows to fill the card beside the Black Book; the list scrolls past
// that, and on a narrow screen, where the card stands alone, it is cut to 8.
export default async function MailWidget({ sites, canEdit, max = 25 }) {
  const { items, unavailable } = await fleetMail(sites);
  const unread = items.filter((m) => m.unread).length;
  const backlinks = items.filter((m) => m.kind === "backlink").length;

  return (
    <Widget
      span={6}
      title={
        <>
          <span className="dw-mail-ic dw-head-ic" aria-hidden="true">
            <MailIcon />
          </span>
          Mail worth reading
        </>
      }
      sub="every title's inbox, minus the marketing and the machines"
      href="/mail"
      linkLabel="Open mailbox"
      className="dw-mail dw-light"
      actions={canEdit && <MarkAllRead unread={unread} />}
    >
      <MailSearch icon={false} />
      <div className="dw-mail-tiles">
        <Link href="/mail?show=unread" className="dw-mtile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b9cff" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5.5" width="18" height="13" rx="2" />
            <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
          </svg>
          <span>
            <b className="num">{unread}</b> unread worth reading
          </span>
        </Link>
        <Link href="/mail?show=backlink" className="dw-mtile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12a150" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
          <span>
            <b className="num">{backlinks}</b> backlink {backlinks === 1 ? "reply" : "replies"}
          </span>
        </Link>
      </div>
      {items.length ? (
        <div className="dw-mlist dw-list-fill">
          {items.slice(0, max).map((m) => (
            <MailRow key={`${m.site.slug}-${m.id}`} m={m} />
          ))}
        </div>
      ) : (
        <WidgetNote>Nothing needing attention.</WidgetNote>
      )}
      {unavailable.length > 0 && <WidgetNote>Mailbox not readable for {unavailable.join(", ")}.</WidgetNote>}
    </Widget>
  );
}
