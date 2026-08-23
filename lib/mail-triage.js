// Which inbox messages deserve a human's eyes.
//
// The titles' mailboxes collect three kinds of mail: replies from people we
// asked for backlinks (the whole point), other real correspondence, and a sea
// of marketing, notifications and auto-replies. The dashboard widget should
// show the first two and none of the third, so the sorting lives here rather
// than in a component.
import { listInbox } from "./gmail";

// "Jane Doe <jane@acme.com>" → { name, email, domain }
export function parseAddress(from) {
  const m = String(from).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : String(from)).trim().toLowerCase();
  return {
    name: (m && m[1].trim()) || email,
    email,
    domain: email.split("@")[1] || "",
  };
}

// Local parts that are machinery, never a correspondent. info@ and hello@ are
// deliberately NOT here: they are exactly where a small company's press
// replies come from.
const MACHINE_LOCALPARTS =
  /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce[s]?|notifications?|newsletters?|marketing|updates|alerts?|billing|receipts?)([+.-]|$)/i;

function isAutomated(msg, fromParsed) {
  if (msg.autoSubmitted) return true;
  if (["bulk", "junk", "auto_reply", "list"].includes(msg.precedence)) return true;
  if (msg.listUnsubscribe) return true;
  return MACHINE_LOCALPARTS.test(fromParsed.email.split("@")[0]);
}

/**
 * One title's inbox, sorted into what matters.
 *
 * A message counts as a backlink reply when its sender — or anyone at the same
 * company domain, since press teams reply from colleagues' addresses — is a
 * contact the outreach engine has a row for. Backlink replies survive the
 * automation filter (an out-of-office from a prospect still tells you the
 * address is alive); everything else must look like a person to appear.
 */
export async function noteworthyMail(site, creds, db, { max = 15 } = {}) {
  const inbox = await listInbox(creds?.outreach, { max });
  if (!inbox.available) return { available: false, reason: inbox.reason, items: [] };

  const rows = await db.outreachEmail.findMany({
    where: { contactEmail: { not: null } },
    select: { contactEmail: true },
  });
  const contactEmails = new Set(rows.map((r) => r.contactEmail.toLowerCase()));
  const contactDomains = new Set([...contactEmails].map((e) => e.split("@")[1]).filter(Boolean));

  const items = [];
  for (const msg of inbox.messages) {
    const from = parseAddress(msg.from);
    const isBacklink =
      contactEmails.has(from.email) ||
      (contactDomains.has(from.domain) && from.email.split("@")[0] !== "mailer-daemon");

    if (isBacklink) {
      items.push({ ...msg, fromParsed: from, kind: "backlink", site: { slug: site.slug, name: site.name } });
    } else if (!isAutomated(msg, from)) {
      items.push({ ...msg, fromParsed: from, kind: "human", site: { slug: site.slug, name: site.name } });
    }
  }
  return { available: true, address: inbox.address, items };
}
