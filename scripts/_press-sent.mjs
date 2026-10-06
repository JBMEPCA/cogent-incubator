import { getGoogleAccessToken } from "../lib/google.js";
const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], "jb@thefleetmagazine.co.uk");
const h = { Authorization: `Bearer ${tok}` };
const l = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent("in:sent to:bdpagency.com newer_than:1d")}`, { headers: h })).json();
console.log("sent to bdpagency today:", (l.messages || []).length);
const labels = new Map(((await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", { headers: h })).json()).labels || []).map((x) => [x.id, x.name]));
for (const { id } of l.messages || []) {
  const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: h })).json();
  const H = (n) => m.payload.headers.find((x) => x.name.toLowerCase() === n)?.value;
  let text = ""; (function w(p) { if (!p) return; if (p.mimeType === "text/plain" && p.body?.data) text += Buffer.from(p.body.data, "base64url").toString(); (p.parts || []).forEach(w); })(m.payload);
  console.log(`\n${new Date(Number(m.internalDate)).toLocaleString("en-GB", { timeZone: "Europe/London" })} From: ${H("from")} To: ${H("to")}\nSubject: ${H("subject")}\n${text.trim()}`);
}
for (const id of ["1a0c3e9d7208c28e"]) {
  const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=minimal`, { headers: h })).json();
  console.log("\nrelease labels:", (m.labelIds || []).map((x) => labels.get(x) || x).join(", "));
}
