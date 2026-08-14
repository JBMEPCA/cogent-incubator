# The engine's clock

A Cloudflare Worker that drives the publishing engine on a real hourly
schedule, because GitHub Actions does not.

## Why this exists

`schedule` events on a free private GitHub repo are dropped under load rather
than queued. Measured on this repo:

| Workflow | Cron asked for | Actually ran (48h) |
| --- | --- | --- |
| Publishing engine | 15/day | 3 |
| Hourly feed scan | 24/day | 7 |

The engine looked asleep because nothing was waking it.

## Deploy

Cloudflare's free plan covers this: cron triggers are included, and the five
subrequests per run are nothing against the free limits.

From this directory:

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

Then set the secret. Wrangler prompts for the value and stores it encrypted —
paste the same `CRON_SECRET` the app already uses (it is in the app's `.env`
and in the Vercel and GitHub Actions secrets):

```bash
npx wrangler secret put CRON_SECRET
```

## Check it works

Fire it by hand without waiting for the hour:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://smart-sme-cron.<your-subdomain>.workers.dev
```

It returns one line per step with the status and the start of each response.
Scheduled runs show up under Workers > smart-sme-cron > Logs.

## Turn the GitHub schedule off afterwards

Once this is confirmed working, drop the `schedule:` block from
`.github/workflows/publishing-engine.yml` and leave `workflow_dispatch:` so the
manual trigger still exists. Running both clocks means the Director runs twice
an hour and bills twice for it.
