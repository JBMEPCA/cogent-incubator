# Stadium and Arena Business: launch tracker

Started 17 November 2026, as one of the five titles in the wave-7 batch.
**This title is NOT live.** The domain is bought; the site does not exist yet.
The tracker is written before launch on purpose, so the open items below are a
live list rather than something reconstructed weeks later (playbook §12).

| | |
|---|---|
| Domain | **stadiumarenabusiness.com** - REGISTERED 18 Nov 2026, nameservers still at GoDaddy |
| Slug | `stadium-arena-business` |
| Site folder | `stadium-arena-business-website` (git repo, first commit made, no remote) |
| Theme | `child/`, child of cogent-base |
| Mark | S18, the stack |
| Face and colour | Archivo; Floodlight blue #1F3FBF on arena navy #0E1A3A |
| Interview series | Meet the Venue |
| Byline | `james-burke` PLACEHOLDER until the owner is named |

## What this title is

Stadium and Arena Business covers the business of running and building stadiums, arenas and concert halls.

**Scope rule.** Not a sports news title: no match reports, results, transfers or team news, ever. No gambling: betting firms sponsor many venues, a naming-rights story may state the sponsor as fact and nothing here promotes betting. A restricted category on the shared Mailchimp and LinkedIn accounts risks the whole fleet's distribution.

## Done

- [x] Child theme generated from the wave-7 config: palette, face, 8 sections,
      `cogent_brand`, `cogent_author_slug`, `cogent_home_sections`, popup on.
- [x] Drawn masthead, favicon and avatar installed from the brand kit (13 files).
- [x] Title added to **both** maps in `check-title-agnostic.mjs`; all 16 children pass.
- [x] Email masthead and footer built, so the newsletter cannot send the name as text.
- [x] Site folder is a git repo with a first commit and a CLAUDE.md.
- [x] **57 sources seeded-ready, 57 with a feed verified by fetch on 17 Nov 2026**
      (`scripts/stadium-arena-business-sources.mjs`). The 30-feed launch floor is met.
- [x] Wave-1 content plan written, 4 briefs, every source anchor verified on the
      live web (`scripts/batch-plan-stadium-arena-business.json`). Headlines all under 60 characters;
      every category matches a real section.

### Wave-1 articles

| Key | Section | Headline |
|---|---|---|
| `uk-stadium-build-cost-2026` | Projects & Builds | What a new UK stadium costs to build in 2026 |
| `stadium-naming-rights-value` | Sponsorship & Naming | What stadium naming rights are actually worth |
| `safety-certificate-green-guide-capacity` | Safety & Operations | How a venue is licensed to hold a crowd |
| `premium-hospitality-yield-per-seat` | Hospitality & Catering | Premium hospitality: what a seat really yields |

## Blocked on JB, in order

Each step blocks the next. DNS is the only one with a mandatory wait, so it
starts the clock.

- [x] **1. Register stadiumarenabusiness.com.** Done 18 Nov 2026 at 10:44 UTC, confirmed by
      RDAP. Nameservers are still GoDaddy's, which is correct until step 2.
- [ ] **2. Create the site at SiteGround, then point nameservers.** Never the
      reverse: flipping nameservers before the host has a DNS zone takes the
      domain dark.
- [ ] **3. Wait.** DNS propagates, then Let's Encrypt issues. Neither can be
      hurried. HTTPS Enforce must be ON afterwards; a valid certificate alone
      is not enough.
- [ ] **4. Google Workspace: add stadiumarenabusiness.com as a SECONDARY domain** to the
      existing org, never a new Workspace. Create `jb@stadiumarenabusiness.com`. No
      `news@` on the root: news goes through `news.stadiumarenabusiness.com`.
- [ ] **5. GA4 property** in the Cogent Titles account under cimeshot@gmail.com,
      then add the `cogent_ga4_id` filter to `child/functions.php`. There is
      deliberately no filter yet. Verify the tag is really on the page: Site Kit
      tags with a `GT-` container, so grepping for `G-` proves nothing.
- [ ] **6. Mailchimp audience named exactly `Stadium and Arena Business`**, plus an
      authenticated `news.stadiumarenabusiness.com` sending domain. A name mismatch queues
      every signup locally, visible only on this title's settings page.
- [ ] **7. LinkedIn company page**, then add `linkedin_url` to the brand
      filter. Never guess a handle; confirm it through LinkedIn's own
      `organizations?q=vanityName` lookup.
- [ ] **8. Private GitHub repo** for `stadium-arena-business-website`, remote added, pushed,
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
- [ ] `node scripts/stadium-arena-business-sources.mjs --site=stadium-arena-business`
- [ ] Store the `wordpress` and `sftp` credentials; let the probe pass.
- [ ] Set the daily spend cap on this title AND confirm every existing one.
- [ ] `node scripts/set-publisher-logo.mjs --site=stadium-arena-business` once the palette is live.
- [ ] Run wave 1 from `scripts/batch-plan-stadium-arena-business.json`.

## Before calling it launched

```
node scripts/verify-title.mjs --site=stadium-arena-business      # must be 20/20
node scripts/check-all-titles.mjs                 # every title, not just this one
node scripts/check-pages.mjs --site=stadium-arena-business
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
