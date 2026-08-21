import { cronGuard } from "@/lib/cron";
import { getSiteContext } from "@/lib/site";
import { renderOutreach, logoUrl, unsubscribeUrl } from "@/lib/outreach";
import { sendGmail, isGmailConfigured, gmailSetupHint, outreachSender } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Proof-of-template sends, for JB's eyes only.
//
// Renders the exact email the engine would send — real template code, real
// per-title sender identity, real logo URL, real footer — and delivers it to
// an internal address. It reads a recent drafted row so the proof shows real
// copy, but it never writes to OutreachEmail and never emails a prospect;
// nothing about a row's status changes because a proof of it was sent.
//
//   POST { "to": "jb@smartsme.co.uk", "slugs": ["smart-sme", ...] }
//
// Guarded like the cron routes: this can put mail on the wire, so it must not
// be callable by anyone who happens to find the URL.
export async function POST(request) {
  const guard = cronGuard(request);
  if (guard) return guard;

  const { to, slugs } = await request.json().catch(() => ({}));
  if (!to || !Array.isArray(slugs) || !slugs.length) {
    return Response.json({ error: 'POST { "to": "...", "slugs": ["..."] }' }, { status: 400 });
  }

  const results = [];
  for (const slug of slugs) {
    try {
      const ctx = await getSiteContext(slug);
      if (!ctx) {
        results.push({ slug, ok: false, error: "unknown title" });
        continue;
      }
      const { site, creds, db } = ctx;
      if (!isGmailConfigured(creds?.outreach)) {
        results.push({ slug, ok: false, error: gmailSetupHint(creds?.outreach) });
        continue;
      }

      // The most recent row with model-written copy, so the proof shows a
      // real article and a real opening. A title with no drafts yet gets a
      // clearly-labelled stand-in row instead of being skipped.
      const row =
        (await db.outreachEmail.findFirst({
          where: { body: { not: null } },
          orderBy: { createdAt: "desc" },
          include: { brand: true },
        })) || sampleRow(site);

      const { subject, text, html } = renderOutreach(site, row, row.brand || null, {
        outreach: creds.outreach,
      });
      await sendGmail({
        outreach: creds.outreach,
        to,
        subject: `[PROOF · ${site.name}] ${subject}`,
        text,
        html,
        unsubscribeUrl: row.brandId ? unsubscribeUrl(row.brandId) : null,
      });

      results.push({
        slug,
        ok: true,
        from: outreachSender(creds.outreach)?.email,
        logo: logoUrl(site),
        sampleRow: row.id || "synthetic",
      });
    } catch (err) {
      results.push({ slug, ok: false, error: String(err?.message || err) });
    }
  }

  return Response.json({ results });
}

function sampleRow(site) {
  return {
    id: null,
    brandId: null,
    brand: null,
    brandName: "Example Company",
    contactName: "Sam",
    contactEmail: "press@example.com",
    subject: `Example Company featured in ${site.name}`,
    body:
      `Hi Sam,\n\nWe've just published a piece on Example Company's latest launch, ` +
      `and thought your team would want to see it.`,
    articleTitle: `Example Company brings its new launch to market`,
    articleUrl: `https://${site.domain}/example-article/`,
  };
}
