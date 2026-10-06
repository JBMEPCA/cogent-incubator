import { mc } from "../lib/newsletter.js";
const d = await mc(`/reports?count=60&type=regular&sort_field=send_time&sort_dir=DESC`);
const r = (d.reports || []).find((x) => x.campaign_title?.startsWith("Smart SME Weekly - Thursday, 24"));
console.log(JSON.stringify({ ...r, timeseries: undefined, industry_stats: undefined }, null, 1).slice(0, 2600));
