export default function Logo({ scale = 1 }) {
  return (
    <span className="logo-lockup" style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "left center" } : undefined}>
      <span className="logo-row">
        <span>Smart</span>
        <span className="logo-sme">SME</span>
      </span>
      <span className="logo-mag">MAGAZINE</span>
    </span>
  );
}
