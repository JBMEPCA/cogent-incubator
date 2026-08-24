// Says so, once, at the top of every screen. A read-only account with no
// explanation looks like a broken one the first time a button does nothing.
export default function ReadOnlyBanner() {
  return (
    <div className="readonly-bar">
      <span className="readonly-dot" />
      <strong>Viewer</strong>
      <span>Read-only account — you can open and read everything, but nothing can be changed.</span>
    </div>
  );
}
