import { getGoogleAccessToken, googleGet } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.modify"], HUB);
const q = encodeURIComponent("newer_than:60d (label:Topics/Press OR to:press@)");
let page, ids = [];
do {
  const r = await googleGet(token, `${API}/messages?q=${q}&maxResults=100${page ? `&pageToken=${page}` : ""}`);
  ids = ids.concat(r.messages || []);
  page = r.nextPageToken;
} while (page && ids.length < 500);
console.log("press messages in 60 days:", ids.length);
const OURS = /cimltd\.co\.uk|smartsme|thefleetmagazine|golfresortmagazine|barberingbusiness|airportbusinessmagazine|gymbusinessnews|nurserydaily|seniorlifestylebusiness|dentalbusinessnews|smartfarmingnews|cogentmultimedia|carehomemagazine|thehotelmagazine/i;
const by = {};
for (const m of ids) {
  const d = await googleGet(token, `${API}/messages/${m.id}?format=metadata&metadataHeaders=From`);
  const from = (d.payload?.headers || []).find((h) => h.name.toLowerCase() === "from")?.value || "";
  const email = (from.match(/<([^>]+)>/) || [null, from])[1].toLowerCase().trim();
  const name = from.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  const domain = email.split("@")[1] || "";
  if (!domain || OURS.test(domain) || /noreply|no-reply|notification|mailer|bounce/.test(email)) continue;
  by[domain] = by[domain] || { n: 0, people: new Set() };
  by[domain].n++;
  if (name) by[domain].people.add(name);
}
const rows = Object.entries(by).sort((a, b) => b[1].n - a[1].n);
console.log("distinct sending domains:", rows.length);
import("node:fs").then((fs) => fs.writeFileSync("C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/press-senders.json", JSON.stringify(rows.map((r) => r[0]))));
for (const [d, v] of rows.slice(0, 45)) console.log(`${String(v.n).padStart(3)}  ${d.padEnd(32)} ${[...v.people].slice(0, 3).join(", ").slice(0, 60)}`);
