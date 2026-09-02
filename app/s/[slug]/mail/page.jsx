import Link from "next/link";
import Header from "@/app/components/Header";
import SubTabs, { ANALYTICS_TABS } from "@/app/components/SubTabs";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { listInbox, outreachSender } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The title's own mailbox, inside the app. Read-only on purpose: replying,
// archiving and everything else stays in Gmail, where drafts, history and
// undo already exist. This page answers "has anyone written back?" without
// leaving the dashboard — the mailboxes are real Workspace accounts nobody
// signs into day to day, so without this tab their mail is invisible.

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

// "Jane Doe <jane@acme.com>" → { name: "Jane Doe", email: "jane@acme.com" }
function parseFrom(from) {
  const m = String(from).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].toLowerCase() };
  return { name: from, email: String(from).toLowerCase() };
}

export default async function MailPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;

  const inbox = await listInbox(creds?.outreach, { max: 25 });

  // Which senders are outreach prospects, so a reply to the engine's own email
  // is visibly different from general mail landing in the same box.
  let prospectEmails = new Set();
  if (inbox.available && inbox.messages.length) {
    const rows = await db.outreachEmail.findMany({
      where: { contactEmail: { not: null } },
      select: { contactEmail: true },
    });
    prospectEmails = new Set(rows.map((r) => r.contactEmail.toLowerCase()));
  }

  const address = inbox.available ? inbox.address : outreachSender(creds?.outreach)?.email;

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
        <SubTabs items={ANALYTICS_TABS} active="/mail" />

        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Mail</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 680 }}>
            The inbox of {address ? <strong>{address}</strong> : "this title's mailbox"}, read-only.
            Reply from Gmail itself — this page is for seeing what has come in without leaving the
            dashboard.
          </p>
        </section>

        {!inbox.available && (
          <div className="panel" style={{ color: "var(--neon-amber)", fontSize: 14 }}>
            {inbox.reason}
          </div>
        )}

        {inbox.available && inbox.messages.length === 0 && (
          <div className="panel" style={{ color: "var(--muted)", fontSize: 14 }}>
            The inbox is empty.
          </div>
        )}

        {inbox.available && inbox.messages.length > 0 && (
          <div className="stagger" style={{ display: "grid", gap: 10 }}>
            {inbox.messages.map((m) => {
              const from = parseFrom(m.from);
              const isProspect = prospectEmails.has(from.email);
              return (
                <Link
                  key={m.id}
                  href={`/s/${site.slug}/mail/${m.id}`}
                  className="panel"
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14, fontWeight: m.unread ? 700 : 500 }}>
                      {from.name}
                    </strong>
                    {isProspect && <span className="chip chip-audience">outreach reply</span>}
                    {m.unread && <span className="chip chip-brand">unread</span>}
                    <span className="micro" style={{ color: "var(--muted)", marginLeft: "auto" }}>
                      {fmt(m.date)}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, margin: "4px 0 2px", fontWeight: m.unread ? 600 : 400 }}>
                    {m.subject}
                  </div>
                  <div className="micro" style={{ color: "var(--muted)" }}>{m.snippet}</div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
