import fs from "node:fs";
import os from "node:os";
const cfg = `${os.homedir()}/AppData/Roaming/xdg.config/.wrangler/config/default.toml`;
if (!fs.existsSync(cfg)) { console.log("no wrangler config at", cfg); process.exit(1); }
const text = fs.readFileSync(cfg, "utf8");
const token = (text.match(/oauth_token\s*=\s*"([^"]+)"/) || [])[1];
if (!token) { console.log("no oauth token in config"); process.exit(1); }
const h = { authorization: `Bearer ${token}` };
const accounts = await (await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: h })).json();
const acct = accounts.result?.[0];
console.log("account:", acct?.name);
const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct.id}/workers/scripts/smart-sme-cron`, { headers: h });
const src = await res.text();
console.log("live script bytes:", src.length);
for (const probe of ["hour === 14", "Mon", "/api/cron/briefing", "MAX_DRIP_PER_TICK"]) {
  console.log(`  ${src.includes(probe) ? "PRESENT" : "MISSING"}  ${probe}`);
}
