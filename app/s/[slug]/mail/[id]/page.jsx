import Link from "next/link";
import Header from "@/app/components/Header";
import SubTabs, { ANALYTICS_TABS } from "@/app/components/SubTabs";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { readInboxMessage } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One message, as plain text. The HTML part is never rendered — see
// readInboxMessage — so a stranger's markup cannot run inside the dashboard.

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default async function MailMessagePage({ params }) {
  const { slug, id } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, creds } = ctx;

  const msg = await readInboxMessage(creds?.outreach, id);
  if (!msg) notFound();

  return (
    <>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={ANALYTICS_TABS} active="/mail" />

        <p style={{ margin: "0 0 14px" }}>
          <Link href={`/s/${site.slug}/mail`} className="micro" style={{ color: "var(--neon-cyan)" }}>
            ← Back to the inbox
          </Link>
        </p>

        <article className="panel">
          <h1 style={{ margin: "0 0 10px", fontSize: 19 }}>{msg.subject}</h1>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 2px" }}>
            From {msg.from}
          </p>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 2px" }}>
            To {msg.to}
          </p>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px" }}>
            {fmt(msg.date)}
          </p>
          <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "0 0 14px" }} />
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {msg.body}
          </div>
        </article>
      </main>
    </>
  );
}
