// The shape of a page while its data is still coming.
//
// Every page in this app is `force-dynamic`, and until now not one of them had
// a Suspense boundary above it. That combination has a specific and horrible
// consequence: React has nothing it is allowed to show early, so a tap on a nav
// link blocks on the *complete* server render before a single pixel changes.
// The browser keeps drawing the page you just left, which is indistinguishable
// from a tap that did not register, so you tap again.
//
// A `loading.js` is the whole fix. It gives React something to flush
// immediately, which means the new page appears at once in outline, and it also
// makes `<Link>` prefetch meaningful: without a loading boundary Next has no
// static shell to prefetch for a dynamic route, so every prefetch was a no-op.
//
// These are deliberately dumb grey boxes rather than a spinner. A spinner says
// "something is happening"; a skeleton in roughly the right shape says "the
// thing you asked for is arriving, and here is where it will be", which is the
// difference between waiting and not knowing.

export function SkelLine({ w = "100%", h = 13, style }) {
  return <span className="skel" style={{ display: "block", width: w, height: h, ...style }} />;
}

/** A panel-shaped placeholder: a label, a figure, and a couple of rows. */
export function SkelPanel({ rows = 3, figure = false }) {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <SkelLine w="38%" h={10} style={{ marginBottom: figure ? 12 : 16 }} />
      {figure && <SkelLine w="52%" h={26} style={{ marginBottom: 16 }} />}
      {Array.from({ length: rows }).map((_, i) => (
        <SkelLine
          key={i}
          // Ragged right, like real text. Equal-length bars read as a table and
          // set the wrong expectation for what is about to appear.
          w={`${92 - i * 13}%`}
          style={{ marginBottom: i === rows - 1 ? 0 : 10 }}
        />
      ))}
    </div>
  );
}

/** The body of a page: a wide summary strip, then a grid of panels. */
export default function Skeleton({ panels = 6 }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="panel" style={{ padding: "18px 20px" }}>
        <SkelLine w="26%" h={10} style={{ marginBottom: 12 }} />
        <SkelLine w="44%" h={30} />
      </div>
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 272px), 1fr))",
        }}
      >
        {Array.from({ length: panels }).map((_, i) => (
          <SkelPanel key={i} rows={i % 2 ? 2 : 3} figure={i < 3} />
        ))}
      </div>
    </div>
  );
}
