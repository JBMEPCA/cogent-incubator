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

## Moving the clock to the fleet app

The Worker drives whatever `BASE_URL` points at, defaulting to the old
single-title app. Repointing it IS the cutover: there is one clock, so the old
app stops being driven at the same moment the new one starts, and the two can
never both publish to the same WordPress.

Do it in this order. Steps 1 and 2 change nothing on their own, and step 3 is a
one-line undo.

1. **Deploy the fleet app** with its environment variables set — in particular
   `CREDENTIAL_KEY`, which must be byte-identical to the one the per-title
   credentials were encrypted under. A different key does not read as "not
   configured", it reads as corrupt.
2. **Switch the engine on** for each title that should run, under
   `/s/<slug>/settings` and the title's engine controls. A title with
   `engineEnabled = false` is skipped by every cron, so this is safe to do
   before the clock moves.
3. **Repoint the Worker:**

   ```bash
   npx wrangler deploy --var BASE_URL:https://cogent-incubator.vercel.app
   ```

   To go back, deploy again without the flag.

Confirm with the manual trigger before waiting on the hour. Each step in the
response names the title it ran for, so a fleet response with `"sites": 0` means
no title has its engine on rather than that the engine is broken.
