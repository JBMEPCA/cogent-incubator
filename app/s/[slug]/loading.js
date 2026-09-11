import Header from "@/app/components/Header";
import Skeleton from "@/app/components/Skeleton";

// Shown the instant you tap anything inside a title, and replaced the moment
// the real page has its data.
//
// The Header is drawn here rather than left out, which is the whole point of
// putting the boundary at this level: it reads the active title from fleet
// context (a client provider in the root layout, already in memory), so it can
// render with no data of its own. The nav therefore does not flicker or move
// between pages, and what you see is a page that has already arrived and is
// filling in, rather than the app going blank and coming back.

export default function SiteLoading() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px clamp(14px, 4vw, 24px) 40px" }}>
        <Skeleton />
      </main>
    </>
  );
}
