import { prisma } from "@/lib/prisma";
import { siteCredentials } from "@/lib/site";
import { sendGmail, isGmailConfigured } from "@/lib/gmail";
import { cronGuard } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The engine's dead-letter box. The Cloudflare Worker collects a result for
// every step it fires and, until this route existed, threw the lot away: a
// step returning 500 every hour for a week looked exactly like a step
// returning 200, and the only sign the sweep had died was the absence of the
// messages it used to write. lib/agents/backlink.js already escalates a failed
// Search Console snapshot for precisely that reason - "a bare catch meant the
// graph could stop updating for weeks with nothing anywhere to say it had" -
// and this applies the same reasoning one level up: the Worker now posts its
// failures here, and this emails them to a human.
//
// Deduped per step path through GlobalSetting, at most one email per path per
// ALERT_COOLDOWN_HOURS, so a step failing all day is one email, not fourteen.
// The email goes out through the first title with a working Gmail credential:
// the alert must not depend on the health of any one title, only on at least
// one being able to send at all.
const ALERT_TO = "jb@cimltd.co.uk";
const ALERT_COOLDOWN_HOURS = 6;

async function alertSender() {
  const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, slug: true } });
  for (const s of sites) {
    try {
      const { creds } = await siteCredentials(s.id);
      if (isGmailConfigured(creds.outreach)) return { slug: s.slug, outreach: creds.outreach };
    } catch {
      // A broken credential on one title must not stop the hunt.
    }
  }
  return null;
}

export async function POST(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  // The alarm itself must never fail silently. An unhandled throw here is an
  // empty 500 that the Worker records and nobody reads - the same class of
  // blindness this endpoint exists to end - so everything below reports its
  // own failure in the response body.
  try {
    return await handle(request);
  } catch (e) {
    return Response.json({ error: `alert route failed: ${e?.message || e}` }, { status: 500 });
  }
}

async function handle(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const failures = Array.isArray(body?.failures) ? body.failures.slice(0, 40) : [];
  if (!failures.length) return Response.json({ skipped: "no failures reported" });

  // One GlobalSetting row per failing path holds the last time it was emailed
  // about. Only paths outside the cooldown make this email; if every path is
  // inside it, the report is recorded in the response and nothing sends.
  const now = Date.now();
  const cutoff = now - ALERT_COOLDOWN_HOURS * 3600 * 1000;
  const fresh = [];
  for (const f of failures) {
    const key = `alert:${String(f.path || "unknown").slice(0, 120)}`;
    const row = await prisma.globalSetting.findUnique({ where: { key } });
    if (row && Number(row.value) > cutoff) continue;
    fresh.push(f);
  }
  if (!fresh.length) {
    return Response.json({ skipped: `all ${failures.length} failing step(s) already alerted within ${ALERT_COOLDOWN_HOURS}h` });
  }

  const sender = await alertSender();
  if (!sender) {
    // Nothing can send. Say so loudly in the response - the Worker records it -
    // rather than pretending the alert went out.
    return Response.json({ error: "no title has a working Gmail credential to send the alert from" }, { status: 500 });
  }

  const lines = fresh.map((f) =>
    `${f.path}\n  ${f.error ? `error: ${f.error}` : `status ${f.status}`}${f.body ? `\n  body: ${String(f.body).slice(0, 300)}` : ""}`
  );
  const text = `The engine's scheduled sweep is reporting failures.

Source: ${body.source || "cloudflare-worker"}
Time: ${new Date(now).toISOString()} (UTC)

Failing steps:

${lines.join("\n\n")}

Each failing step is emailed at most once every ${ALERT_COOLDOWN_HOURS} hours while it keeps failing. Check /workflows on the dashboard, Vercel logs for the route, or run the step by hand with the CRON_SECRET to see the full response.`;

  await sendGmail({
    outreach: sender.outreach,
    to: ALERT_TO,
    subject: `[Cogent engine] ${fresh.length} scheduled step${fresh.length === 1 ? "" : "s"} failing`,
    text,
  });

  for (const f of fresh) {
    const key = `alert:${String(f.path || "unknown").slice(0, 120)}`;
    await prisma.globalSetting.upsert({
      where: { key },
      update: { value: String(now) },
      create: { key, value: String(now) },
    });
  }

  return Response.json({ alerted: fresh.length, via: sender.slug, to: ALERT_TO });
}
