import { getSiteContext } from "./site";
import { noteworthyMail } from "./mail-triage";

/**
 * Mail worth reading across every title's mailbox, newest first.
 *
 * Shared by the home page widget and the full /mail page so the two can never
 * disagree about what counts. A mailbox that cannot be read is named in
 * `unavailable` rather than failing the whole list.
 */
export async function fleetMail(sites, { perSite = 15 } = {}) {
  const results = await Promise.all(
    sites.map(async (s) => {
      try {
        const ctx = await getSiteContext(s.slug);
        if (!ctx) return null;
        return await noteworthyMail(ctx.site, ctx.creds, ctx.db, { max: perSite });
      } catch {
        return null;
      }
    })
  );

  const unavailable = [];
  const items = [];
  results.forEach((r, i) => {
    if (!r) return;
    if (!r.available) unavailable.push(sites[i].name);
    else items.push(...r.items.map((m) => ({ ...m, site: { ...m.site, accentHex: sites[i].accentHex } })));
  });
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return { items, unavailable };
}

/** Day and time in UK local, short: "8 Oct, 09:42", or just "09:42" today. */
export function mailTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const opts = { timeZone: "Europe/London" };
  const day = (x) => x.toLocaleDateString("en-GB", opts);
  if (day(d) === day(new Date())) {
    return d.toLocaleTimeString("en-GB", { ...opts, hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "short" });
}
