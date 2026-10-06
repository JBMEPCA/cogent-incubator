// One press release, end to end: the email's parts, the run, the article.
import { PrismaClient } from "@prisma/client";
import { getGoogleAccessToken } from "../lib/google.js";
const [mailbox, query] = process.argv.slice(2);
const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], mailbox);
const h = { Authorization: `Bearer ${tok}` };
const l = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=3`, { headers: h })).json();
const labels = new Map(((await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", { headers: h })).json()).labels || []).map((x) => [x.id, x.name]));
const p = new PrismaClient();
for (const { id } of l.messages || []) {
  const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: h })).json();
  const H = (n) => m.payload.headers.find((x) => x.name.toLowerCase() === n)?.value;
  console.log(`\n=== ${id} ${new Date(Number(m.internalDate)).toLocaleString("en-GB", { timeZone: "Europe/London" })}\nFrom: ${H("from")}\nSubject: ${H("subject")}\nLabels: ${(m.labelIds || []).map((x) => labels.get(x) || x).join(", ")}`);
  (function w(pt, d = 0) { if (!pt) return; console.log(`${"  ".repeat(d)}- ${pt.mimeType} "${pt.filename || ""}" ${pt.body?.size || 0}B${pt.body?.attachmentId ? " [attachment]" : ""}${(pt.headers || []).find((x) => /content-disposition/i.test(x.name))?.value?.slice(0, 40) || ""}`); (pt.parts || []).forEach((c) => w(c, d + 1)); })(m.payload);
  let html = ""; (function w(pt) { if (!pt) return; if (pt.mimeType === "text/html" && pt.body?.data) html += Buffer.from(pt.body.data, "base64url").toString(); (pt.parts || []).forEach(w); })(m.payload);
  console.log("img tags:", [...html.matchAll(/<img\b[^>]*>/gi)].map((x) => x[0].slice(0, 160)).slice(0, 8).join("\n   "));
  const rows = await p.$queryRawUnsafe(`select f.status fstatus, left(f.summary, 60) fsum, a.title, a.status, a."wpPostId", a."imageUrl", a."imageSource", a."imageCredit", a."costUsd" from "FeedItem" f left join "Article" a on a."sourceItemId" = f.id where f.link = $1`, `gmail:${id}`);
  console.log("DB:", JSON.stringify(rows, null, 1));
}
await p.$disconnect();
