import { prisma, forSite, fleetRead } from "@/lib/prisma";
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

/**
 * Find the brand without knowing its title yet.
 *
 * This link arrives from an email with nothing but a brand id and a token, so
 * there is no site in the URL to scope by — the lookup has to search the fleet
 * and then narrow. fleetRead() is read-only, and the token has already been
 * verified before we get here.
 */
async function findBrand(brandId) {
  const rows = await fleetRead().prBrand.findMany({
    where: { id: brandId },
    select: { id: true, siteId: true, name: true, website: true, optedOut: true },
    take: 1,
  });
  if (!rows.length) return null;
  const brand = rows[0];
  const site = await prisma.site.findUnique({
    where: { id: brand.siteId },
    select: { id: true, name: true },
  });
  return site ? { brand, site } : null;
}

/** The domain an opt-out binds to. Falls back to the name when there is no URL. */
function domainOf(brand) {
  if (!brand.website) return null;
  try {
    return new URL(brand.website.startsWith("http") ? brand.website : `https://${brand.website}`)
      .hostname.replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

async function optOut(brand, site) {
  const db = forSite(brand.siteId);

  await db.prBrand.update({
    where: { id: brand.id },
    data: { optedOut: true, optedOutAt: new Date() },
  });

  // Anything still queued for them goes with it. An opt-out that leaves a
  // pending email in the approval queue is an opt-out waiting to be ignored.
  await db.outreachEmail.updateMany({
    where: { brandId: brand.id, status: { in: ["pending", "approved", "failed"] } },
    data: { status: "dismissed" },
  });

  // The important part at fleet scale: the opt-out is recorded GLOBALLY, keyed
  // by domain. A brand that opts out of one title and then hears from four
  // sister titles is the most damaging thing this system could do to the
  // company's name, and under UK B2B direct-marketing expectations it is
  // indefensible. The single send path checks this table.
  const domain = domainOf(brand);
  if (domain) {
    await prisma.outreachOptOut.upsert({
      where: { domain },
      create: { domain, brandName: brand.name, sourceSite: site.name },
      update: { brandName: brand.name },
    });
  }
}

// One-click, per RFC 8058: the mail client POSTs and we act immediately.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("b");
  if (!verifyUnsubscribeToken(brandId, searchParams.get("t"))) {
    return new Response("Invalid unsubscribe link", { status: 400 });
  }
  const found = await findBrand(brandId);
  if (!found) return new Response("Unknown record", { status: 404 });

  try {
    await optOut(found.brand, found.site);
  } catch {
    return new Response("Unknown record", { status: 404 });
  }
  return page(
    "Unsubscribed",
    "<p>You will not hear from us again — this applies across every one of our titles, not just the one that contacted you.</p>"
  );
}

// A human clicking the link gets a confirmation step. Mailbox providers and
// link scanners follow GET links on their own, and a bare GET that opts out
// would let a security scanner unsubscribe a company that never saw the email.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("b");
  const token = searchParams.get("t");
  if (!verifyUnsubscribeToken(brandId, token)) {
    return page(
      "Link not recognised",
      "<p>This unsubscribe link is not valid. Reply to the email instead and we will take care of it.</p>"
    );
  }

  const found = await findBrand(brandId);
  if (!found) return page("Link not recognised", "<p>We could not find that record.</p>");
  const { brand, site } = found;

  if (brand.optedOut) {
    return page("Already unsubscribed", `<p>${brand.name} is already opted out.</p>`);
  }
  return page(
    "Unsubscribe",
    `<p>Stop ${site.name} sending outreach about ${brand.name}? This will also stop every other title we publish.</p>
     <form method="post" action="/api/unsubscribe?b=${encodeURIComponent(brandId)}&t=${encodeURIComponent(token)}">
       <button type="submit" style="font:inherit;padding:9px 20px;border-radius:7px;border:1px solid #111;background:#111;color:#fff;cursor:pointer">Yes, unsubscribe</button>
     </form>`
  );
}
