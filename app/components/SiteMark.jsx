// The square mark that identifies a title in the rail, on a fleet card, and in
// a title's own header.
//
// Deliberately renders from text by default rather than requiring artwork.
// Smart SME's own logo is already a CSS type lockup — "Smart" plus a glowing
// "SME" chip — not a file, and following that means a new title has a usable,
// on-brand mark the moment it is named. Waiting on a designer to produce
// twenty-five square PNGs before the rail looks right would be the wrong order
// of work. markUrl takes over whenever real artwork exists.

export function initials(name) {
  const words = String(name || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const STATUS_TONE = {
  live: { dot: "var(--neon-green)", label: "Live" },
  cold_start: { dot: "var(--neon-cyan)", label: "Cold start" },
  setup: { dot: "var(--neon-amber)", label: "In setup" },
  paused: { dot: "var(--muted)", label: "Paused" },
  archived: { dot: "var(--muted)", label: "Archived" },
};

export function statusTone(status) {
  return STATUS_TONE[status] || STATUS_TONE.setup;
}

export default function SiteMark({ site, size = 44, active = false, showStatus = true }) {
  const label = site.markAccent || initials(site.name);
  const tone = statusTone(site.status);
  const dim = site.status === "paused" || site.status === "archived";

  return (
    <span
      className={`site-mark${active ? " is-active" : ""}${dim ? " is-dim" : ""}`}
      style={{
        width: size,
        height: size,
        // The accent is the title's, so a rail of ten titles reads as ten
        // brands rather than ten identical blue squares.
        background: `linear-gradient(150deg, ${site.accentHex} 0%, ${site.accent2Hex || site.accentHex} 120%)`,
        fontSize: Math.max(10, Math.round(size * (label.length > 3 ? 0.26 : 0.32))),
      }}
    >
      {site.markUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={site.markUrl} alt="" className="site-mark-img" />
      ) : (
        <span className="site-mark-text">{label}</span>
      )}
      {showStatus && <span className="site-mark-dot" style={{ background: tone.dot }} />}
    </span>
  );
}

/** An unfilled slot in the rail — the entry point to provisioning a new title. */
export function SiteMarkEmpty({ size = 44, active = false }) {
  return (
    <span
      className={`site-mark site-mark-empty${active ? " is-active" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="site-mark-plus">+</span>
    </span>
  );
}
