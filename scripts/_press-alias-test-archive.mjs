import { getGoogleAccessToken } from "../lib/google.js";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
for (const u of ["jb@smartsme.co.uk","jb@gymbusinessnews.com","jb@nurserydaily.com","jb@smartfarmingnews.com","jb@seniorlifestylebusiness.com","jb@dentalbusinessnews.com"]) {
  const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.modify"], u);
  const h = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
  const ids = ((await (await fetch(`${API}/messages?q=${encodeURIComponent('subject:"Press alias test" in:inbox')}`, { headers: h })).json()).messages || []);
  for (const { id } of ids) await fetch(`${API}/messages/${id}/modify`, { method: "POST", headers: h, body: JSON.stringify({ removeLabelIds: ["INBOX", "UNREAD"] }) });
  console.log(u, "archived", ids.length);
}
