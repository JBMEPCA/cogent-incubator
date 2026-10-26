import { mc } from "../lib/newsletter.js";
const lists = await mc(`/lists?count=50&fields=lists.id,lists.name`);
const want = process.argv[2] || "Airport Business Magazine";
const list = lists.lists.find((l) => l.name === want);
const reps = await mc(`/reports?count=50&type=regular&since_send_time=2026-10-01T00:00:00Z&fields=reports.id,reports.list_id,reports.send_time,reports.campaign_title,reports.emails_sent`);
const camp = reps.reports.filter((r) => r.list_id === list.id).sort((a, b) => b.send_time.localeCompare(a.send_time))[1]; // second newest, so clicks have settled
const sent = new Date(camp.send_time);
let offset = 0, clicks = [], people = 0;
while (true) {
  const a = await mc(`/reports/${camp.id}/email-activity?count=1000&offset=${offset}&fields=emails.activity`);
  for (const e of a.emails || []) { const c = (e.activity || []).filter((x) => x.action === "click"); if (c.length) { people++; clicks.push(...c.map((x) => ({ t: (new Date(x.timestamp) - sent) / 1000, url: x.url, n: c.length, first: new Date(Math.min(...c.map(y => +new Date(y.timestamp)))) , ts: new Date(x.timestamp) }))); } }
  if (!a.emails || a.emails.length < 1000) break; offset += 1000;
}
// per clicker: how many links, and the spread between their first and last click
const byPerson = {};
for (const c of clicks) { const k = c.first.toISOString() + c.n; (byPerson[k] ||= []).push(c.ts); }
const spans = Object.values(byPerson).map((ts) => (Math.max(...ts) - Math.min(...ts)) / 1000);
const many = Object.values(byPerson).filter((ts) => ts.length >= 5).length;
const fast = spans.filter((s, i) => Object.values(byPerson)[i].length >= 3 && s <= 10).length;
console.log(`${want}: "${camp.campaign_title}" sent ${camp.send_time} to ${camp.emails_sent}`);
console.log(`clickers ${people}, clicks ${clicks.length}`);
console.log(`clickers who clicked 5+ links: ${many}`);
console.log(`clickers who clicked 3+ links all within 10 seconds (scanner signature): ${fast}`);
const within = (s) => clicks.filter((c) => c.t <= s).length;
console.log(`clicks within 2 min of send: ${within(120)}, within 10 min: ${within(600)}, within 1h: ${within(3600)}`);
