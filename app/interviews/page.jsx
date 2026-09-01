import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import SiteMark from "@/app/components/SiteMark";
import { prisma } from "@/lib/prisma";
import { interviewStats, STATUS_LABEL } from "@/lib/interviews";

export const dynamic = "force-dynamic";

const STATUS_CHIP = {
  pending: "chip-general",
  asked: "chip-content",
  agreed: "chip-brand",
  questioned: "chip-content",
  answered: "chip-audience",
  drafted: "chip-brand",
  published: "chip-audience",
  declined: "chip-general",
  exhausted: "chip-monetise",
  bounced: "chip-monetise",
  failed: "chip-monetise",
};

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FleetInterviewsPage() {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

  const perSite = await Promise.all(
    sites.map(async (s) => ({
      site: s,
      stats: await interviewStats(prisma, s.id),
    }))
  );

  // Anything a person has actually done sits above the per-title tiles: across
  // five titles the interesting row is always a reply, never a send.
  const needsEyes = await prisma.interviewTarget.findMany({
    where: { status: { in: ["agreed", "answered", "drafted"] } },
    include: { site: { select: { slug: true, name: true } } },
    orderBy: [{ agreedAt: "desc" }, { createdAt: "desc" }],
    take: 40,
  });

  const recent = await prisma.interviewTarget.findMany({
    where: { status: { in: ["asked", "questioned", "published", "declined", "bounced", "exhausted"] } },
    include: { site: { select: { slug: true, name: true } } },
    orderBy: [{ askedAt: "desc" }, { createdAt: "desc" }],
    take: 40,
  });

  const fleet = perSite.reduce(
    (a, p) => ({
      asked: a.asked + p.stats.asked,
      agreed: a.agreed + p.stats.agreed,
      published: a.published + p.stats.published,
      pending: a.pending + p.stats.pending,
      unreachable: a.unreachable + p.stats.unreachable,
    }),
    { asked: 0, agreed: 0, published: 0, pending: 0, unreachable: 0 }
  );
  const fleetReply = fleet.asked ? Math.round((fleet.agreed / fleet.asked) * 100) : null;

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Interviews</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Across the fleet</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 640 }}>
                Every title&rsquo;s people-led pipeline in one place: who has been asked, who said
                yes, and which titles have gone quiet.
              </p>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Queued", value: fleet.pending },
                { label: "Asked", value: fleet.asked },
                { label: "Said yes", value: fleet.agreed },
                { label: "Published", value: fleet.published },
                { label: "Reply rate", value: fleetReply == null ? "—" : `${fleetReply}%` },
                { label: "Unreachable", value: fleet.unreachable },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Per title */}
        <section className="panel stagger" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>By title</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {perSite.map(({ site, stats }) => (
              <Link
                key={site.id}
                href={`/s/${site.slug}/interviews`}
                className="panel"
                style={{ padding: 14, textDecoration: "none", display: "block" }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <SiteMark site={site} size={30} showStatus={false} />
                  <strong style={{ fontSize: 14 }}>{site.name}</strong>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{stats.asked}</div>
                    <div className="stat-label">asked</div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{stats.agreed}</div>
                    <div className="stat-label">yes</div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{stats.published}</div>
                    <div className="stat-label">live</div>
                  </div>
                </div>
                {stats.total === 0 && (
                  <p className="micro" style={{ color: "var(--neon-amber)", margin: "10px 0 0" }}>
                    Not started
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Replies first */}
        <section className="panel stagger" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Replies, all titles</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px" }}>
            The only rows on this page that represent a human being having said yes.
          </p>
          {needsEyes.length === 0 ? (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>No replies yet.</p>
          ) : (
            <FleetTable rows={needsEyes} dateField="agreedAt" dateLabel="Replied" />
          )}
        </section>

        <section className="panel stagger">
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Recently asked</h2>
          <FleetTable rows={recent} dateField="askedAt" dateLabel="Asked" />
        </section>
      </div>
    </main>
  );
}

function FleetTable({ rows, dateField, dateLabel }) {
  if (!rows.length) {
    return <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>Nothing yet.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            <th style={{ padding: "6px 10px 6px 0", fontWeight: 500 }}>Title</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Person</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Company</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>{dateLabel}</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 10px 8px 0" }}>
                <Link href={`/s/${t.site.slug}/interviews`} style={{ color: "var(--neon-cyan)" }}>
                  {t.site.name}
                </Link>
              </td>
              <td style={{ padding: "8px 10px" }}>
                <strong>{t.personName}</strong>
                {t.personRole && (
                  <div className="micro" style={{ color: "var(--muted)" }}>{t.personRole}</div>
                )}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{t.company}</td>
              <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{fmtDateTime(t[dateField])}</td>
              <td style={{ padding: "8px 10px" }}>
                <span className={`chip ${STATUS_CHIP[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
