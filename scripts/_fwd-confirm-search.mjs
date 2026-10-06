import { getGoogleAccessToken } from "../lib/google.js";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], "jb@smartsme.co.uk");
const h = { Authorization: `Bearer ${tok}` };
const q = 'from:forwarding-noreply@google.com newer_than:10d';
const ids = (await (await fetch(`${API}/messages?includeSpamTrash=true&q=${encodeURIComponent(q)}`, { headers: h })).json()).messages || [];
console.log("confirmation emails:", ids.length);
for (const { id } of ids) {
  const m = await (await fetch(`${API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`, { headers: h })).json();
  console.log(m.payload.headers.map((x) => x.value).join(" | "), m.labelIds.join(","));
}
