// Read-only: has press@smartsme.co.uk ever received mail?
import { getGoogleAccessToken } from "../lib/google.js";
const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], "jb@smartsme.co.uk");
const h = { Authorization: `Bearer ${tok}` };
for (const q of ["to:press@smartsme.co.uk", "deliveredto:press@smartsme.co.uk", "to:press@smartsme.co.uk -from:me"]) {
  const l = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`, { headers: h })).json();
  const ids = l.messages || [];
  console.log(q, ids.length);
  for (const { id } of ids.slice(0, 5)) {
    const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: h })).json();
    console.log("   " + m.payload.headers.map((x) => x.value).join(" | ").slice(0, 140));
  }
}
