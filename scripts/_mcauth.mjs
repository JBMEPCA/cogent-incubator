import { mc } from "../lib/newsletter.js";
try {
  const j = await mc(`/verified-domains`);
  console.log("Mailchimp verified/authenticated sending domains:");
  for (const d of j.domains||[]) console.log(`  ${String(d.domain).padEnd(34)} verified=${d.verified}  authenticated=${d.authenticated}`);
} catch (e) { console.log("verified-domains failed:", e.message.slice(0,140)); }
