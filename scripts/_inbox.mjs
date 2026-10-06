import { getGoogleAccessToken, googleGet } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.modify"], HUB);
const labels = (await googleGet(token, `${API}/labels`)).labels || [];
const byId = Object.fromEntries(labels.map((l) => [l.id, l.name]));
console.log("LABELS:", labels.map((l) => `${l.name}(${l.messagesUnread ?? 0}u/${l.messagesTotal ?? 0})`).filter((n) => !/^CATEGORY_|^CHAT$|^SENT$|^DRAFT$|^SPAM$|^TRASH$|^IMPORTANT$|^STARRED$|^UNREAD$/.test(n)).join("  "));
const q = encodeURIComponent("in:inbox newer_than:8d");
let page, all = [];
do {
  const r = await googleGet(token, `${API}/messages?q=${q}&maxResults=100${page ? `&pageToken=${page}` : ""}`);
  all = all.concat(r.messages || []);
  page = r.nextPageToken;
} while (page && all.length < 300);
console.log("\nINBOX messages (8 days):", all.length);
const out = [];
for (const m of all) {
  const d = await googleGet(token, `${API}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Delivered-To`);
  const h = Object.fromEntries((d.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  out.push({
    id: m.id,
    date: new Date(Number(d.internalDate)).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    ts: Number(d.internalDate),
    from: (h.from || "").slice(0, 46),
    subject: (h.subject || "").slice(0, 62),
    to: (h["delivered-to"] || h.to || "").slice(0, 34),
    labels: (d.labelIds || []).map((x) => byId[x] || x).filter((n) => !/^CATEGORY_|^INBOX$|^UNREAD$|^IMPORTANT$|^STARRED$/.test(n)),
    unread: (d.labelIds || []).includes("UNREAD"),
  });
}
out.sort((a, b) => b.ts - a.ts);
console.log(JSON.stringify(out));
