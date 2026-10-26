import { mc } from "../lib/newsletter.js";
const j = await mc(`/campaigns?count=25&sort_field=create_time&sort_dir=DESC&fields=campaigns.id,campaigns.status,campaigns.create_time,campaigns.send_time,campaigns.settings.title,campaigns.recipients.list_id,campaigns.emails_sent`);
for (const c of j.campaigns||[]) {
  console.log(`${(c.create_time||"").slice(0,16)}  ${String(c.status).padEnd(10)} sent=${String(c.emails_sent||0).padStart(6)}  ${(c.settings?.title||"").slice(0,54)}`);
}
