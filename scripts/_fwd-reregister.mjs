// Re-register a PENDING forwarding address to the hub, then switch forwarding on
// if Google accepts it. Only ever touches an address that is pending, i.e. not
// forwarding anything today.
import { getGoogleAccessToken } from "../lib/google.js";
const HUB = "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me/settings";
for (const u of process.argv.slice(2)) {
  const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.settings.sharing", "https://www.googleapis.com/auth/gmail.settings.basic"], u);
  const h = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  const cur = await (await fetch(`${API}/forwardingAddresses/${HUB}`, { headers: h })).json();
  if (cur.verificationStatus !== "pending") { console.log(u, "not pending:", cur.verificationStatus); continue; }
  const del = await fetch(`${API}/forwardingAddresses/${HUB}`, { method: "DELETE", headers: h });
  const made = await (await fetch(`${API}/forwardingAddresses`, { method: "POST", headers: h, body: JSON.stringify({ forwardingEmail: HUB }) })).json();
  console.log(u, "delete", del.status, "-> re-created:", made.verificationStatus || JSON.stringify(made).slice(0, 200));
  if (made.verificationStatus === "accepted") {
    const on = await (await fetch(`${API}/autoForwarding`, { method: "PUT", headers: h, body: JSON.stringify({ enabled: true, emailAddress: HUB, disposition: "leaveInInbox" }) })).json();
    console.log("   forwarding:", JSON.stringify(on));
  }
}
