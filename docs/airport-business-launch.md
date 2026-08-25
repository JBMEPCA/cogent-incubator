# Airport Business Magazine — launch tracking

Title #5. Decision 24 Aug 2026 (JB): name **Airport Business Magazine**, global,
`.com` primary. Vertical case: `docs/vertical-brief-airports.md`. Process:
`docs/new-title-playbook.md` — this file tracks *this* title's run through it.

Slug: **`airport-business-magazine`**. Session prefix: ✈️ AIRPORT. Project
folder: `airport-business-magazine-website`.

---

## JB's critical path (starts the clock — nothing downstream moves without #3)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **IPO/EUIPO trademark check** on "Airport Business Magazine" — classes 16, 41, 35, 9 | ✅ 24 Aug | JB: cleared, "good to go" |
| 2 | **Register domains** | ✅ partial, 24 Aug | **`.com` registered 24 Aug 2026 (12:42 UTC, RDAP-confirmed) — PRIMARY.** `.co.uk` defensive still unregistered (~£10). `airportmagazine.com` expires 20 Dec 2026 — drop-watch, bonus only |
| 3 | **Create site at SiteGround**, point nameservers, SSL | ✅ 24 Aug | Server c1116205.sgvps.net (same box as Fleet/Golf/Barbering, site user u21-fqeyi6rqrqqm). Let's Encrypt installed + **HTTPS Enforce on** (verified: valid cert, http→https 301) |
| 4 | **Google Workspace secondary domain + DKIM + SPF** | ✅ 24 Aug | MX → smtp.google.com, Google DKIM published, and SPF **edited in place** to `v=spf1 +a +mx include:_spf.google.com include:...dnssmarthost.net ~all` (verified live) |
| 5 | **Mailchimp audience + sending domain** | ✅ 24 Aug | Audience `Airport Business Magazine` (fc5a96f64e) exists; `news.airportbusinessmagazine.com` verified AND authenticated; credential stored + probe green |
| 6 | **LinkedIn company page** | ☐ deferred? | Same call as barbering (deferred there). `linkedin_url` stays unset; the sidebar card renders nothing |
| 7 | **GA4 property + Search Console** | ✅ 24 Aug | GA4 "Airport Business Magazine" property **551264772** verified by name via the Admin API; web stream **G-YWVDR4QFLL** now set in the child's `cogent_ga4_id` filter; `sc-domain:airportbusinessmagazine.com` in GSC with the service account as siteFullUser; credential stored + probe green |
| 8 | **Tom's advertiser answers, in writing** (the Dec test) | ☐ | Which suppliers/airports he can actually reach, whether any would take a launch slot, who would be quoted. No CIM crossover book exists for this title — this is the commercial gate |
| 9 | **Name the byline person** | ✅ 24 Aug | **James Burke**, same as the other titles. Site row `authorName` set; WP user #3 `james-burke` (nicename correct, demoted from JB's initial administrator to author per playbook; the duplicate `jamesburke` user I created was deleted) |

## Engine-side (Claude) — runs in parallel with DNS

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 24 Aug | **48 verified feeds** in `docs/airport-business-sources.md` (16 policy/trade-body/data, 18 trade+construction press incl. 12 competitor-flagged, 9 supplier, 5 airports/operators) + 18 documented newsrooms.js candidates. IAR, Heathrow, Schiphol, MAG, SITA and Smiths Detection have NO feeds — the top newsrooms.js block to hand-verify during the DNS wait |
| B | Content plan `scripts/batch-plan-airport-business-magazine.json` | ✅ 24 Aug | 12 briefs, 3 waves, every one aimed at a SERP measured undefended in the brief (§3). **Canonical section list (site must be created with exactly these):** News · Revenue & Commercial · Expansion & Construction · Technology & Systems · Operations & Resilience · Route Development · Sustainability & Energy |
| C | Search set in `lib/news-searches.js` + `SEARCH_SETS` | ✅ 24 Aug | `AIRPORT_NEWS_SEARCHES`, 15 queries, per-beat GB/US locales (the US wire is half the usable supply), `NO_PAX` + `NO_AIRPORT_INCIDENT` exclusion blocks. Never seed bare `airport`, `airport terminal` or `airport parking` |
| D | Child theme `airport-business-magazine-website/child` | ✅ scaffold 24 Aug | Launch-safe baseline: apron navy / wayfinding amber palette, amber masthead chip, 7 section patterns, nav, home template, Archivo + JetBrains Mono. Data-dense by design (Tom's visual brief) — the parent's stats furniture stays ON for this title, no parent changes needed |
| E | `cogent_brand` filter in child | ✅ 24 Aug | Audience, newsletter copy, contact_email set; `mailchimp_audience` + `linkedin_url` deliberately left to resolve from JB steps 5–6 with loud comments; GA4 filter commented until step 7 |
| F | Title in `TITLES` + `CHILDREN` in `check-title-agnostic.mjs` | ✅ 24 Aug | Full sweep passes: parent + all 5 children clean. Tenancy grep for the previous title's name: only comments and derived code, no bugs |
| G | Editorial standing rules in `docs/editorial-standard.md` | ✅ 24 Aug | "Airport Business Magazine — four rules": buyer rule, scope-and-figure rule, geopolitics rule, incident rule. Also embedded in the Site row's `editorialStandardMd` |
| H | Site row seeded (engine OFF, status setup, $5/day cap, target 3/day, sections locked) | ✅ 24 Aug | `seed-airport-title.mjs`. Scan cron ignores setup+engine-off titles, so live titles' budgets are untouched |
| H2 | News searches seeded | ✅ 24 Aug | 15 of 15 scannable, categories all match sections |
| I | Sources seeded + coverage-checked | ✅ 24 Aug | `seed-airport-sources.mjs`: 83 sources created (48 with verified feeds, 35 hub-only newsrooms/outreach rows) → **98 total with the searches**. `check-feed-coverage.mjs` buckets 98/98 OK; "never scanned" is correct while status=setup |
| J | WordPress provisioning: Yoast BEFORE first publish; Engine user; byline user | ✅ 24 Aug | Yoast active before anything published; Engine user (editor, app password, probe green, correctly forbidden from settings); byline WP user #3 `james-burke` at author with the nicename right; Sample Page deleted; permalinks `/%postname%/`; timezone Europe/London; title + strapline set. WAF check: this server does NOT 403 the `<TitleName>Bot` UA (200 observed) — no action needed, publisher sends Editorial/1.0 anyway |
| K | Theme deploy over SFTP, activate, template option, purge | ✅ 24 Aug | Parent (44 files) + child (15 files) deployed; child active on `cogent-base`; caches purged; cache-busted homepage verified (correct title, masthead lockup, parent stylesheet referenced). **Analytics: Site Kit is doing the tagging** (JB installed it) — property 551264772, measurement G-YWVDR4QFLL, GT-5DDBZC6S alias, useSnippet true, exactly ONE tag on the page; the child's `cogent_ga4_id` filter stands aside while Site Kit tags, and stays as the fallback |
| L | Credentials stored in app + probes green | ✅ 24 Aug | wordpress ✅ ("Connected as Engine") · mailchimp ✅ · google_analytics ✅ · sftp ✅ (host c1116205.sgvps.net, user u21-fqeyi6rqrqqm, key `~/.ssh/cogent-deploy` — proven by the theme deploy itself) |
| M | Tools pages | ✅ none at launch | Deliberate: no calculators transfer. The title's data tools (development tracker, non-aero league) are their own build, post-launch |
| N | Pre-flight checklist (playbook §4) run in full | ✅ 24 Aug | `check-title-agnostic --all`: 6 themes PASS · `check-all-titles`: 8/8, every live title healthy after the parent deploy · caps confirmed on all 5 titles ($10/$5/$5/$5/$5) · `origin/main..HEAD` = 0 (uncommitted working-tree changes exist across sessions — nothing production runs; commit pending JB) · feed coverage 98/98 |
| O | `verify-title` → engine ON, wave 1 | ✅ **20/20, 24 Aug — "Ready to run unattended". LIVE** | **ENGINE ON, status cold_start.** Wave 1: **3 of 4 published same day** (~6,900 words: how-airports-make-money $0.73 incl. one re-run · non-aero-revenue-benchmarks $0.51 · airport-parking-revenue $0.50). The production cron picked the title up on its own within the hour: 171 wire items, 22 sources scanned, first agent run (SEO 14:06). Masthead reworked same day on JB feedback: sky blue `#5AA9F0` chip + kicker replacing amber/dark navy; favicon follows the palette automatically. Day-report daily for the first week; watch spend > $0 |
| P | **`cost-to-build-an-airport` — PARKED, do not re-draft again** | ☐ | Held 3× (~$1.70 sunk), a NEW objection each round — the §8 non-converging loop. Final recorded issues are small and actionable: needs a 2nd outbound primary-source link, and the Western Sydney "on budget" clause softened/attributed. Fix via the repair path on the EXISTING 2,268-word draft (re-arm it), never another fresh draft. The brief now carries full row-level source anchors, which is what got the money pillar through — reuse that pattern for waves 2–3 |

## Post-launch build queue (the title's own asymmetric weapons, brief §8)

1. **Global Airport Development Tracker** — the flagship; no editorial incumbent
   (competition is a $995 GlobalData report and a paid email newsletter). The
   pipeline article in wave 3 is its seed content.
2. **Non-Aero Revenue League** — annual benchmark franchise from listed
   operators' accounts + ACI aggregates.
3. Contract-award ledger, drop-off/parking charge index, disruption cost
   ledger, Games-ready tracker — all reduce to one structured project database
   with scheduled enrichment.

## Open questions / watch list

- **Apollo list**: brief for Lucas at `docs/apollo-brief-airport-business-magazine.md`
  (24 Aug, fleet-brief shape). CSV blocked on nothing; emailing the list is
  blocked on JB steps 4-5 (Mailchimp audience + `news.` sending domain) and on
  the per-jurisdiction legal tranching in the brief — Canada held out entirely.

- **Trademark**: the masthead's public debut gates on JB step 1. If it comes
  back uncomfortable, `theairportmagazine.com` was free on 24 Aug as the hedge.
- `.co.uk` defensive unregistered — anyone can take it; ~£10 to close off.
- `airportmagazine.com` expires 20 Dec 2026 — drop-watch.
- Keyword collisions: airport target queries checked against the other four
  titles' registries — no overlap (nearest miss is none; fleet/SME/golf/barber
  share no airport terms).
- Google Workspace licence per title is the £5–14/month cost the playbook §5
  flags — same decision as every title, JB's call at step 4.
- Newsletter, LinkedIn and outreach all seeded OFF; switch on deliberately,
  not by default.
