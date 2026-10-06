// Throwaway: prove the hub's new filters have not blinded anything the engine
// depends on. Every check here mirrors a real query in lib/gmail.js.
import { getGoogleAccessToken } from "../lib/google.js";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const READ = ["https://www.googleapis.com/auth/gmail.readonly"];
const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true } } },
});
await prisma.$disconnect();

const count = async (token, q) => {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then((x) => x.json());
  return (r.messages || []).length;
};

for (const c of creds) {
  const { fromEmail } = decryptJson(c.payloadEnc);
  const token = await getGoogleAccessToken(READ, fromEmail);
  // bouncedSince() searches exactly this, and Gmail search skips Trash.
  const bounces = await count(token, "from:(mailer-daemon OR postmaster) newer_than:60d");
  const bouncesBinned = await count(token, "in:trash from:(mailer-daemon OR postmaster)");
  // runInterviewSweep() searches exactly this.
  const interviews = await count(
    token,
    '-from:me newer_than:21d (subject:"Seven questions for" OR subject:"Featuring you in")'
  );
  const interviewsLost = await count(
    token,
    '(in:trash OR in:spam) (subject:"Seven questions for" OR subject:"Featuring you in")'
  );
  const inbox = await count(token, "in:inbox");
  console.log(
    `${c.site.name.padEnd(26)} bounces visible=${bounces} binned=${bouncesBinned} | interview replies visible=${interviews} lost=${interviewsLost} | inbox=${inbox}`
  );
}
