import { NextResponse } from "next/server";
import { needsImageCount } from "@/lib/needs-image";

// The number on the nav badge.
//
// Its own route because FleetNav is a client component rendered in every
// page's header: making it a server component to read one integer would mean
// threading the count through every page that uses it. One small query, called
// once per page load, is the cheaper trade.
//
// Behind the auth proxy like everything else, so it is only ever called by a
// signed-in browser that is already looking at the dashboard.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ count: await needsImageCount() });
  } catch (e) {
    // A badge is not worth an error page. Report nothing and let the nav render.
    return NextResponse.json({ count: null, error: String(e.message).slice(0, 120) }, { status: 200 });
  }
}
