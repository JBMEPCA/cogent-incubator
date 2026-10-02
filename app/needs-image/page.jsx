import Link from "next/link";
import FleetNav from "../components/FleetNav";
import PhotoUploader from "../s/[slug]/content/article/[id]/PhotoUploader";
import { needsImage } from "@/lib/needs-image";
import { uploadImageForHeldArticle } from "@/lib/actions";

export const dynamic = "force-dynamic";

// The articles a person has to picture by hand.
//
// They are here because of JB's rule of 2 Oct 2026: a story about a named
// person we cannot photograph is held rather than given a generated name card
// or a stock photo. Holding it is right and the pile is the point, but a pile
// nobody can see is just a stalled queue. This is where it gets worked.
//
// Deliberately narrow, which is the whole design. Only person stories appear:
// everywhere else the Designer sources its own picture and retires what it
// cannot do, so listing those would bury the ones that actually need a human
// under the ones that are simply mid-flight.

function when(d) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default async function NeedsImagePage() {
  let rows = [];
  let error = null;
  try {
    rows = await needsImage();
  } catch (e) {
    error = String(e.message).split("\n")[0];
  }

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Needs an image</h1>
        </div>
        <FleetNav />
      </header>

      <section className="panel" style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>
          {rows.length ? `${rows.length} waiting on a photograph` : "Nothing waiting"}
        </h3>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)", maxWidth: 820 }}>
          Stories about a named person where no photograph of them could be found. They are held
          rather than published under a stand-in, so each one needs a picture chosen by hand.
        </p>
        <p className="rising-note">
          only person stories appear here · everything else sources its own picture and retires what
          it cannot do · a photo dropped in goes straight to that title&#8217;s media library
        </p>

        {error && (
          <p style={{ color: "var(--neon-red)", fontSize: 13 }}>Could not read the queue: {error}</p>
        )}

        {!error && !rows.length && (
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            No article is waiting on a photograph. Nothing is being held back.
          </p>
        )}

        {rows.map((a) => (
          <div
            key={a.id}
            style={{
              padding: "16px 0",
              borderTop: "1px solid var(--line)",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 320px",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: a.site.accentHex || "var(--brand-2)",
                    flex: "none",
                  }}
                />
                <span className="micro">{a.site.name}</span>
                <span className="micro" style={{ color: "var(--muted)" }}>
                  · {a.status} · held {when(a.updatedAt)}
                </span>
              </div>

              <Link
                href={`/s/${a.site.slug}/content/article/${a.id}`}
                style={{ color: "var(--text)", fontSize: 15, fontWeight: 600, textDecoration: "none" }}
              >
                {a.title}
              </Link>

              {/* The one fact that makes this workable: who to go and find. */}
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Needs a photograph of{" "}
                <strong style={{ color: "var(--text)" }}>{a.subjectName || "the person named"}</strong>
                {a.subjectRole ? `, ${a.subjectRole}` : ""}
                {a.subjectOrg ? `, ${a.subjectOrg}` : ""}.
              </p>

              {a.sourceUrl && (
                <p style={{ margin: "4px 0 0" }}>
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="micro"
                    style={{ color: "var(--neon-cyan)" }}
                  >
                    the source this came from ↗
                  </a>
                </p>
              )}
            </div>

            <PhotoUploader
              articleId={a.id}
              action={uploadImageForHeldArticle}
              currentAlt={
                a.subjectName
                  ? `${a.subjectName}${a.subjectRole ? `, ${a.subjectRole}` : ""}${a.subjectOrg ? `, ${a.subjectOrg}` : ""}`
                  : ""
              }
            />
          </div>
        ))}
      </section>
    </main>
  );
}
