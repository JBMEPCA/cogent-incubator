// Rewrite the parked "you're live" draft to Emily Ireton-Bourke so it
// acknowledges that she had to chase, then optionally send it.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_senior-reply-emily.mjs [--send]
//
// The release reached press@seniorlifestylebusiness.com on 1 Oct 09:00 UK and
// was published at 09:01. The reply was written and parked, because
// press_link_ask has never been written to GlobalSetting and linkAskMode()
// fails closed to "draft".
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const DRAFT_ID = "r3163600821602273106";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const prisma = new PrismaClient();
const cred = await prisma.siteCredential.findFirst({
  where: { kind: "outreach", site: { slug: "senior-lifestyle-business" } },
  select: { payloadEnc: true },
});
await prisma.$disconnect();
const out = decryptJson(cred.payloadEnc);

const token = await getGoogleAccessToken(SCOPES, out.fromEmail);
const api = async (p, init) => {
  const res = await fetch(`${API}${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const txt = await res.text();
  const j = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(`${res.status} ${j?.error?.message || txt.slice(0, 200)}`);
  return j;
};
const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";

const existing = await api(`/drafts/${DRAFT_ID}?format=full`);
const m = existing.message;
const to = hdr(m, "to");
const subject = hdr(m, "subject");
const msgId = hdr(m, "message-id");
const refs = hdr(m, "references");
const inReplyTo = hdr(m, "in-reply-to") || msgId;
console.log(`to       ${to}`);
console.log(`subject  ${subject}`);
console.log(`thread   ${m.threadId}`);

const URL_LIVE = "https://seniorlifestylebusiness.com/tunstall-launches-ilos-platform-for-alarm-receiving-centres/";

const body = [
  "Hello Emily,",
  "",
  "Apologies for the silence, and thank you for following up. The answer is yes: we ran it on Thursday morning, within the hour of it reaching us. It has been live since then and you should have had this note at the time. That is our fault, not yours.",
  "",
  "It is here:",
  "",
  URL_LIVE,
  "",
  "We publish releases like this in full, usually within the hour, and we never charge for it. We are glad to keep doing that.",
  "",
  "In return we ask for one thing, and we would rather say it plainly than hint at it: please link to us. If Tunstall Healthcare keep a news or press page, a link to that article is all we are after. It takes a minute, and it is what pays for the next piece of coverage. A mention on LinkedIn is welcome too, though a link on the site is the part that lasts.",
  "",
  "Either way the article stays up, and future releases to this address come straight to our news desk.",
  "",
  "Many thanks,",
  "Senior Lifestyle Business News Desk",
  "https://seniorlifestylebusiness.com",
].join("\n");

const headers = [
  `To: ${to}`,
  `From: Senior Lifestyle Business News Desk <${hdr(m, "from").match(/<(.+)>/)?.[1] || out.fromEmail}>`,
  `Subject: ${subject}`,
  inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
  refs ? `References: ${refs}` : inReplyTo ? `References: ${inReplyTo}` : null,
  "MIME-Version: 1.0",
  'Content-Type: text/plain; charset="UTF-8"',
].filter(Boolean);

const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");

const updated = await api(`/drafts/${DRAFT_ID}`, {
  method: "PUT",
  body: JSON.stringify({ id: DRAFT_ID, message: { raw, threadId: m.threadId } }),
});
console.log(`\ndraft updated (${updated.id})`);
console.log("----- body now -----");
console.log(body);

if (!SEND) {
  console.log("\nDRY RUN. Nothing sent. Re-run with --send to send it.");
  process.exit(0);
}
const sent = await api(`/drafts/send`, { method: "POST", body: JSON.stringify({ id: DRAFT_ID }) });
console.log(`\nSENT. message ${sent.id}, thread ${sent.threadId}`);
