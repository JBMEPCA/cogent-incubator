import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/outreach";

export const dynamic = "force-dynamic";

// Public by design: see the matcher note in proxy.js. The token is what makes
// that safe, since it only ever authorises opting out one specific brand.

function page(title, message) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px;color:#111;line-height:1.55">
  <h1 style="font-size:20px;margin:0 0 10px">${title}</h1>
  ${message}
</div>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

async function optOut(brandId) {
  await prisma.prBrand.update({
    where: { id: brandId },
    data: { optedOut: true, optedOutAt: new Date() },
  });
  // Anything still queued for them goes with it. An opt-out that leaves a
  // pending email in the approval queue is an opt-out waiting to be ignored.
  await prisma.outreachEmail.updateMany({
    where: { brandId, status: { in: ["pending", "approved", "failed"] } },
    data: { status: "dismissed" },
  });
}

// One-click, per RFC 8058: the mail client POSTs and we act immediately.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("b");
  if (!verifyUnsubscribeToken(brandId, searchParams.get("t"))) {
    return new Response("Invalid unsubscribe link", { status: 400 });
  }
  try {
    await optOut(brandId);
  } catch {
    return new Response("Unknown record", { status: 404 });
  }
  return page("Unsubscribed", "<p>You will not hear from Smart SME outreach again.</p>");
}

// A human clicking the link gets a confirmation step. Mailbox providers and
// link scanners follow GET links on their own, and a bare GET that opts out
// would let a security scanner unsubscribe a company that never saw the email.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("b");
  const token = searchParams.get("t");
  if (!verifyUnsubscribeToken(brandId, token)) {
    return page("Link not recognised", "<p>This unsubscribe link is not valid. Reply to the email instead and we will take care of it.</p>");
  }
  const brand = await prisma.prBrand.findUnique({ where: { id: brandId } });
  if (!brand) return page("Link not recognised", "<p>We could not find that record.</p>");
  if (brand.optedOut) {
    return page("Already unsubscribed", `<p>${brand.name} is already opted out of Smart SME outreach.</p>`);
  }
  return page(
    "Unsubscribe",
    `<p>Stop Smart SME sending outreach about ${brand.name}?</p>
     <form method="post" action="/api/unsubscribe?b=${encodeURIComponent(brandId)}&t=${encodeURIComponent(token)}">
       <button type="submit" style="font:inherit;padding:9px 20px;border-radius:7px;border:1px solid #111;background:#111;color:#fff;cursor:pointer">Yes, unsubscribe</button>
     </form>`
  );
}
