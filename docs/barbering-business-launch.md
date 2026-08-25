# Barbering Business — launch tracking

Title #4. Decision 21 Aug 2026 (JB): name **Barbering Business**, UK-first.
Vertical case: `docs/vertical-brief-barbering.md`. Process:
`docs/new-title-playbook.md` — this file tracks *this* title's run through it.

Slug (proposed): **`barbering-business`**. Session prefix (proposed): 💈 BARBER.

---

## JB's critical path (starts the clock — nothing downstream moves without #2)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **IPO trademark check** on "Barbering Business" — classes 16, 41 (+35, 44) | ☐ | **Manual, from a phone or another machine.** search.ipo.gov.uk GPU-crashes this desktop app (see crash memory). Weak web-only signal found no exact marks |
| 2 | **Register domains** | ✅ 21 Aug (partial, accepted) | **.com registered 21 Aug 2026 at GoDaddy — it is the PRIMARY and only domain.** JB decision 24 Aug: do NOT register the .co.uk/.uk. Site row, seed script and child theme all flipped to .com on 24 Aug |
| 3 | **Create site at SiteGround** (domain barberingbusiness.com), then at GoDaddy point nameservers to `ns1/ns2.siteground.net` (that order — never the reverse) | ✅ 24 Aug | Server c1116205.sgvps.net (same as Fleet/Golf), SSL issued, HTTPS live. The earlier "SiteGround code" blocker resolved |
| 4 | **Google Workspace: add barberingbusiness.com as SECONDARY domain** to the existing org; user is **`jb@barberingbusiness.com`** (full licensed user, same as every title); generate DKIM | ⏳ 24 Aug | JB decision 24 Aug: NO news@ user on the root — news goes through the subdomain, `news@news.barberingbusiness.com` (the Mailchimp sending pattern, like news.smartsme.co.uk). Site row + seed authorEmail updated to match. Root MX/SPF/DKIM still to confirm. Fix SiteGround's SPF by hand — edit the existing record to add `include:_spf.google.com`, never add a second `v=spf1`. The news subdomain gets its own records at the Mailchimp step |
| 5 | **Mailchimp audience** named exactly `Barbering Business` (must match the child's `mailchimp_audience`) | ✅ 24 Aug | Audience `35319dae03` exists; `news.barberingbusiness.com` authenticated as sending domain; credential stored + probe green. (Fleet and Golf audiences now also exist, 0 members — wiring them in is still open, COGENT session) |
| 6 | **LinkedIn company page** for Barbering Business | ☐ deferred | JB 24 Aug: not now. `$brand['linkedin_url']` stays unset; linkedInEnabled false |
| 7 | **GA4 property + Search Console** | ✅ 24 Aug | GA4 "Barbering Business" property 551301806, found via Admin API by name; `sc-domain:barberingbusiness.com` in GSC; service account granted both; credential stored + probe green |
| 8 | **Confirm Dog Grooming advertiser crossover in our own book** (Wahl, Andis, Oster, Artero, Vagaro, both-sides insurers) | ☐ | The golf rule: gate on named crossover advertisers, not research |

## Engine-side (Claude) — can run in parallel with DNS

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 21 Aug | **44 verified feeds** in `docs/barbering-business-sources.md` (18 policy/trade-body, 11 press incl. 8 competitor-flagged, 7 brand, 8 other) + 8 fallback queries. Seed script at build time |
| B | Content plan `scripts/batch-plan-barbering-business.json` | ✅ 21 Aug | 12 briefs, 3 waves, all from verified SERP gaps. **Canonical section list (site must be created with exactly these):** News · Business & Money · Marketing & Clients · Products & Tools · Shop & Fit-Out · Tech & Booking · People & Training · Trends & Services |
| C | Search set in `lib/news-searches.js` + `SEARCH_SETS` | ✅ 21 Aug | `BARBERING_NEWS_SEARCHES`, 12 queries, GB edition, `NO_HAIRCUT` exclusion block; registered for slug `barbering-business`. Trends & Services deliberately has NO wire query (plan-fed only). Seed after Site row exists |
| D | Child theme: new `barbering-business-website/child` | ✅ scaffold 21 Aug | Launch-safe baseline built (oxblood/brass/cream palette, brass masthead chip, 8 section patterns, nav, home template; Archivo fonts are placeholders). **The image-led parent-level pass (§8) is still to do** — it is design work for a 💈 BARBER session and goes through THE RULE |
| E | `cogent_brand` filter in child | ✅ 21 Aug | Audience, newsletter copy, contact_email set; mailchimp_audience + linkedin_url deliberately left to resolve from JB steps 5–6 with loud comments |
| F | Title in `TITLES` + `CHILDREN` in `check-title-agnostic.mjs` | ✅ 21 Aug | Full sweep passes: 5 themes clean, and `check-all-titles` confirms all 3 live titles untouched |
| H2 | Site row + sources + searches seeded in DB | ✅ 21 Aug | `seed-barbering-title.mjs` (engine OFF, status setup, $5/day cap, target 3/day, sections locked), `seed-barbering-sources.mjs` (73 sources, 43 verified feeds), `seed-news-searches.mjs` (12 searches) — 85 scannable sources waiting. Scan cron ignores setup+engine-off titles, so live titles' scan budget is untouched until launch |
| G | Editorial standing rules into `docs/editorial-standard.md`: owner-frame rule + crime-coverage rule (+ figures-as-ranges) | ✅ 21 Aug | Added as "Barbering Business — two rules" per-title section |
| H | Site row seeding + per-title secrets (encrypted in DB, not env) | ✅ 24 Aug | wordpress, mailchimp, google_analytics, sftp all stored + probed green. SFTP: c1116205.sgvps.net, u20-cylyohvu5mzm, key `~/.ssh/cogent-deploy` |
| I | WordPress: Yoast BEFORE first publish; Engine user (editor + app password); byline user `james-burke` | ✅ 24 Aug | Yoast in before first publish; Engine editor + app password verified; byline resolves to WP user #4 (`james-burke`); parent force-assigns every post to that slug anyway. JB's login is the "JB"-displayed admin (jb@cimltd.co.uk); typo'd first admin deleted |
| J | Tools pages: `/tools/` + page per calculator IF this title gets any | ✅ none at launch | Deliberate: image-led title, no calculators in the plan |
| K | Pre-flight checklist (playbook §4) run in full | ✅ 24 Aug | check-title-agnostic --all: 5 themes PASS; caps on all 4 titles confirmed ($5/$5/$5/$10) |
| L | `node scripts/verify-title.mjs --site=barbering-business` all PASS before calling it live | ✅ **20/20, 24 Aug — "Ready to run unattended"** | **ENGINE ON, status cold_start, LIVE.** Wave 1 of the batch plan published same day: chair-rental guide, boom analysis, opening-costs guide, booking-systems buyer's guide — 9,400 words, $1.73 total ($0.43/article). Wire 134 items, 6 topics proposed. Both themes deployed over SFTP + activated; brass chip dropped for oxblood + dark-surface legibility fix (JB). Waves 2–3 of the plan (8 briefs) still unrun — feed them in over the first days rather than all at once. Day-report checks daily for the first week |

## Design notes (the §8 requirement — first title where the child is not a re-skin)

- Photography-first cards/heroes; stats furniture must become optional per-title
  in `cogent-base` (parent change → full sweep).
- Likely dark/high-contrast palette variant; expressive colours stay in the
  child per THE RULE.
- Picture pipeline matters more than any previous title — barber content
  without strong imagery reads as fake to this audience.

## Open questions / watch list

- CIM's defunct "Barber Magazine": old domain still unidentified — JB to
  confirm what it was. If recoverable, a 301 play may add residual link equity;
  Wayback may hold republishable evergreen content (CIM copyright).
  Note: today's naming/SEO position does NOT depend on this.
- `barbershopmagazine.com` (registered 19 Jun 2026 by unknown party) — watch.
- `barberingbusiness.co.uk` left unregistered by choice (JB, 24 Aug) — anyone
  can take it; if that ever stings, it's ~£10 to close off while still free.
- `smartbarber.co.uk/.com`, `barbermagazine.com` — expire Dec 2026, drop-watch.
- Advertiser rows marked *(unverified)* in the brief need one confirmation pass
  before any sales deck.
- Barber Connect exhibitor list (500+) to be requested from Professional
  Beauty Group — the prospect database.
