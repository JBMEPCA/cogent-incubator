import { mc } from "../lib/newsletter.js";
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC`);
const rows = d.reports || [];
console.log("total returned:", rows.length);
rows.slice(0, 8).forEach((r) => console.log(" ", r.send_time, r.list_id, String(r.emails_sent).padStart(5), r.campaign_title?.slice(0, 55)));
const b = rows.filter((r) => r.list_id === "35319dae03");
console.log("barbering rows:", b.map((r) => `${r.send_time} ${r.emails_sent} abuse=${r.abuse_reports}`).join(" | "));
