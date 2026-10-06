import { getGoogleAccessToken } from "../lib/google.js";
const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], "jb@thefleetmagazine.co.uk");
const h = { Authorization: `Bearer ${tok}` };
for (const id of process.argv.slice(2)) {
  const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: h })).json();
  const H = (n) => m.payload.headers.filter((x) => x.name.toLowerCase() === n).map((x) => x.value).join(" / ");
  console.log(`\n=== ${id}\nFrom: ${H("from")}\nReply-To: ${H("reply-to")}\nTo: ${H("to")}\nSubject: ${H("subject")}`);
  const parts = []; (function w(p) { if (!p) return; parts.push(`${p.mimeType} ${p.filename || ""} ${p.body?.size || 0}`); (p.parts || []).forEach(w); })(m.payload);
  console.log("Parts:", parts.join(" | "));
  let text = ""; (function w(p) { if (!p) return; if (p.mimeType === "text/plain" && p.body?.data) text += Buffer.from(p.body.data, "base64url").toString(); (p.parts || []).forEach(w); })(m.payload);
  const hits = text.split(/\n/).filter((l) => /\b(25|50)\b/.test(l)).slice(0, 8);
  console.log("Lines mentioning 25/50:\n  " + hits.join("\n  "));
}
