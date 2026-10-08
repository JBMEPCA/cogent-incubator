// What a brand's or interviewee's reply said about the link, as read by
// lib/link-replies.js: a chip and the gist, on the outreach and interview
// pages. Renders nothing when there is nothing to say.

const CHIP = {
  promised: { label: "Link promised", cls: "chip-monetise" },
  redirected: { label: "Send the request elsewhere", cls: "chip-brand" },
  declined: { label: "Won't link", cls: "chip-general" },
};

export default function LinkVerdict({ row }) {
  if (row.linkLostAt) {
    return (
      <p className="micro" style={{ margin: "4px 0 0", color: "var(--neon-red)" }}>
        Link no longer on the page (checked{" "}
        {new Date(row.linkLostAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })})
      </p>
    );
  }
  const chip = !row.linkedAt && CHIP[row.linkVerdict];
  if (!chip) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap", marginTop: 4 }}>
      <span className={`chip ${chip.cls}`} style={{ fontSize: 10.5 }}>
        {chip.label}
      </span>
      {row.linkNote && <span style={{ fontSize: 12, color: "var(--muted)" }}>{row.linkNote}</span>}
    </div>
  );
}
