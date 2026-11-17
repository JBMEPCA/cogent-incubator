# FM Weekly: launch tracker

Started 17 November 2026, as one of the five titles in the wave-7 batch.
**This title is NOT live.** The tracker is written before launch on purpose, so
the open items below are a live list rather than something reconstructed weeks
later (playbook §12).

| | |
|---|---|
| Domain | **fmweekly.com** - free and UNREGISTERED as at 17 Nov 2026 |
| Slug | `fm-weekly` |
| Site folder | `fm-weekly-website` (git repo, first commit made, no remote) |
| Theme | `child/`, child of cogent-base |
| Mark | F1, the wipe |
| Face and colour | Archivo; Teal #0A8FA0 on slate #0F1720 |
| Interview series | Meet the Contractor |
| Byline | `james-burke` PLACEHOLDER until the owner is named |

## What this title is

FM Weekly covers the business of contract cleaning and soft facilities management.

**Scope rule.** Soft FM and service firms only. Hard FM (plant, HVAC, factory maintenance) stays with MEPCA. ENGIE UK was cut from the source list for exactly this reason.

## Done

- [x] Child theme generated from the wave-7 config: palette, face, 8 sections,
      `cogent_brand`, `cogent_author_slug`, `cogent_home_sections`, popup on.
- [x] Drawn masthead, favicon and avatar installed from the brand kit (13 files).
- [x] Title added to **both** maps in `check-title-agnostic.mjs`; all 16 children pass.
- [x] Email masthead and footer built, so the newsletter cannot send the name as text.
- [x] Site folder is a git repo with a first commit and a CLAUDE.md.
- [x] **63 sources seeded-ready, 63 with a feed verified by fetch on 17 Nov 2026**
      (`scripts/fm-weekly-sources.mjs`). The 30-feed launch floor is met.
- [x] Wave-1 content plan written, 4 briefs, every source anchor verified on the
      live web (`scripts/batch-plan-fm-weekly.json`). Headlines all under 60 characters;
      every category matches a real section.

### Wave-1 articles

| Key | Section | Headline |
|---|---|---|
| `commercial-cleaning-rates-per-hour-uk` | Money & Compliance | Commercial cleaning rates per hour: the 2026 numbers |
| `win-public-sector-cleaning-tender-uk` | Contracts & Tenders | How to win a public sector cleaning tender in 2027 |
| `april-2027-wage-nic-cleaning-margin` | People & Pay | What the April 2027 wage rise does to your margin |
| `cleaning-business-valuation-uk` | Growth & Deals | What a cleaning business is actually worth in 2026 |

## Blocked on JB, in order

Each step blocks the next. DNS is the only one with a mandatory wait, so it
starts the clock.

- [ ] **1. Register fmweekly.com.** Still free at the last check. Nothing below
      can start until this is done.
- [ ] **2. Create the site at SiteGround, then point nameservers.** Never the
      reverse: flipping nameservers before the host has a DNS zone takes the
      domain dark.
- [ ] **3. Wait.** DNS propagates, then Let's Encrypt issues. Neither can be
      hurried. HTTPS Enforce must be ON afterwards; a valid certificate alone
      is not enough.
- [ ] **4. Google Workspace: add fmweekly.com as a SECONDARY domain** to the
      existing org, never a new Workspace. Create `jb@fmweekly.com`. No
      `news@` on the root: news goes through `news.fmweekly.com`.
- [ ] **5. GA4 property** in the Cogent Titles account under cimeshot@gmail.com,
      then add the `cogent_ga4_id` filter to `child/functions.php`. There is
      deliberately no filter yet. Verify the tag is really on the page: Site Kit
      tags with a `GT-` container, so grepping for `G-` proves nothing.
- [ ] **6. Mailchimp audience named exactly `FM Weekly`**, plus an
      authenticated `news.fmweekly.com` sending domain. A name mismatch queues
      every signup locally, visible only on this title's settings page.
- [ ] **7. LinkedIn company page**, then add `linkedin_url` to the brand
      filter. Never guess a handle; confirm it through LinkedIn's own
      `organizations?q=vanityName` lookup.
- [ ] **8. Private GitHub repo** for `fm-weekly-website`, remote added, pushed,
      and the visibility proved with an anonymous `curl` returning 404.

## Then, in the app

- [ ] WordPress + Yoast + Site Kit. Yoast BEFORE the first publish.
- [ ] Two users: `Engine` at **editor** with an application password, and the
      byline account at author. Check the **nicename**, not the login.
- [ ] Deploy parent then child; `wp option update template cogent-base`.
- [ ] Seed the Site row: sections matching the plan's categories exactly,
      `markets`, `dailySpendCapUsd`, `articlesPerDayTarget` (1-7, clamps
      silently above 7), and `newsletterEnabled`, `linkedInEnabled` and
      `outreachEnabled` all seeded OFF.
- [ ] `node scripts/fm-weekly-sources.mjs --site=fm-weekly`
- [ ] Store the `wordpress` and `sftp` credentials; let the probe pass.
- [ ] Set the daily spend cap on this title AND confirm every existing one.
- [ ] `node scripts/set-publisher-logo.mjs --site=fm-weekly` once the palette is live.
- [ ] Run wave 1 from `scripts/batch-plan-fm-weekly.json`.

## Before calling it launched

```
node scripts/verify-title.mjs --site=fm-weekly      # must be 20/20
node scripts/check-all-titles.mjs                 # every title, not just this one
node scripts/check-pages.mjs --site=fm-weekly
node scripts/check-analytics-wiring.mjs
```

Then look at the homepage on a phone, and check the first article's featured
image has alt text on the live page.

## Known at launch, deliberately

- **Outreach stays off until ~20 published articles.** A campaign that lands a
  prospect on a homepage with one article and six empty section headings
  converts worse than no campaign.
- **The newsletter cannot arm until 10 articles have images.** That is a hard
  floor, and it is what keeps a new title waiting.
- **Fleet-wide risk, not this title's:** the Thursday newsletter route runs
  titles serially inside a 300s `maxDuration`. At roughly 23s a title,
  15 titles is about 345s. It does not fail loudly; the titles it never reaches
  simply get no issue. This must be fixed before these five arm their
  newsletters. Re-measure with `?dry=1` first.
- **`lib/reachability.js` has no coverage for this vertical**, so outreach will
  start by emailing the sector's household names. Add the obvious
  non-responders before switching it on.
- Four of the eight sections have no wave-1 article. A section with nothing in
  it hides itself, so this is fine at launch and fills from wave 2.

## Still open after launch

- [ ] Name the title's owner, change `cogent_author_slug`, set
      `Site.authorName`, create the WP user with that nicename BEFORE
      deploying. If the slug does not resolve the parent falls back to user
      ID 1, the administrator.
- [ ] Alignment sheet, within a fortnight, then `scripts/apply-alignment.mjs`.
- [ ] Add what you learn to `docs/new-title-playbook.md` the same day.
