// Reply to Kerry Phillips (The Ehlers Group, for Senior Resource Group) about
// the wrong photo on the Carrington story. Her mail came to
// jb@seniorlifestylebusiness.com, so the reply goes from there, in her thread.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_kerry-reply.mjs [--send]
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const THREAD = "1a15b078c3aa17b9";
const IN_REPLY_TO = "<366cea64-2667-4bf8-ada1-ae9b80b588fa@Spark>";
const TO = "Kerry Phillips <kerry@theehlersgroup.com>";
const SUBJECT = "Re: SRG Story - Incorrect Photo";
const URL = "https://seniorlifestylebusiness.com/senior-resource-group-buys-carrington-hits-23-communities/";

const BODY = [
  "Hi Kerry,",
  "",
  "Thank you for flagging it, and apologies for the error. You were right: the picture on that story was a stock library image, not The Carrington.",
  "",
  "It is fixed. Your photograph is now on the piece and credited to Senior Resource Group:",
  "",
  URL,
  "",
  "The social preview was still serving the old picture behind the scenes, so that has been cleared as well. If you or the team share the link now, it will pull the right image.",
  "",
  "One thing that would stop it happening again. We picked this story up from Argentum rather than from you, so we had nothing of the community itself to run. Anything sent to press@seniorlifestylebusiness.com with photographs attached goes straight to our news desk, and we will always use your pictures rather than a library one.",
  "",
  "Thanks again for taking the trouble to tell us, and for the kind words about the coverage.",
  "",
  "Best,",
  "James Burke",
  "Publisher, Senior Lifestyle Business",
  "https://seniorlifestylebusiness.com",
].join("\n");

const prisma = new PrismaClient();
const cred = await prisma.siteCredential.findFirst({
  where: { kind: "outreach", site: { slug: "senior-lifestyle-business" } },
  select: { payloadEnc: true },
});
await prisma.$disconnect();
const out = decryptJson(cred.payloadEnc);

console.log(`from     ${out.senderName || "James Burke"} <${out.fromEmail}>`);
console.log(`to       ${TO}`);
console.log(`subject  ${SUBJECT}`);
console.log(`thread   ${THREAD}`);
console.log("----------------------------------------");
console.log(BODY);

if (!SEND) {
  console.log("\nDRY RUN. Nothing sent. Re-run with --send.");
  process.exit(0);
}

const headers = [
  `To: ${TO}`,
  `From: James Burke <${out.fromEmail}>`,
  `Subject: ${SUBJECT}`,
  `In-Reply-To: ${IN_REPLY_TO}`,
  `References: ${IN_REPLY_TO}`,
  "MIME-Version: 1.0",
  'Content-Type: text/plain; charset="UTF-8"',
];
const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${BODY}`, "utf8").toString("base64url");

const token = await getGoogleAccessToken(SCOPES, out.fromEmail);
const res = await fetch(`${API}/messages/send`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw, threadId: THREAD }),
});
const json = await res.json();
if (!res.ok) throw new Error(`${res.status} ${json?.error?.message || ""}`);
console.log(`\nSENT. message ${json.id}, thread ${json.threadId}`);
