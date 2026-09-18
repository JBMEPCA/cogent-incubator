# Gym Business News: launch tracking

One of the five titles in the 18 Sep 2026 wave. Name **Gym Business News**,
domain **gymbusinessnews.com** (bought 18 Sep 2026 at GoDaddy, .com only, no
.co.uk). UK-first, global-capable: `markets` = `["GB","US"]`. Spa excluded.
Vertical case: `docs/vertical-brief-gym-fitness-spa.md`, and its
"Refresh, 18 Sep 2026" section supersedes the original on competitors.
Process: `docs/new-title-playbook.md`; this file tracks *this* title's run
through it.

Slug: **`gym-business-news`**. Session prefix: 🏋️ GYM. Project folder:
`gym-business-news-website`.

**Seam:** the business of fitness for small operators (independent gyms,
studios, PT businesses, franchisees): money, compliance, start-up and
workforce guides, software and equipment buying, plus UK and international
franchise, deal and software news as the global layer. Never the practice of
fitness.

---

## JB's critical path (starts the clock; nothing downstream moves without #2)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **Domain** | ✅ 18 Sep | gymbusinessnews.com at GoDaddy, .com only. Nothing else to buy unless a .co.uk defensive is wanted later (~£10, currently unchecked *(unverified whether free)*) |
| 2 | **Create the site at SiteGround** (domain gymbusinessnews.com), THEN point GoDaddy nameservers at `ns1/ns2.siteground.net` | ☐ | That order, never the reverse: flipping nameservers before the host has a zone takes the domain dark. Then Let's Encrypt, then **HTTPS Enforce on** (a valid cert alone is not enough). Check the new server's WAF with `curl -A "GymBusinessNewsBot/1.0" https://gymbusinessnews.com/wp-json/` once live |
| 3 | **Google Workspace: add gymbusinessnews.com as a SECONDARY domain** to the existing org; user **`jb@gymbusinessnews.com`**; generate DKIM | ☐ | Never a new Workspace. No news@ user on the root: news goes through `news@news.gymbusinessnews.com`. Fix SiteGround's SPF by EDITING the existing record to add `include:_spf.google.com`, never a second `v=spf1`. The child theme already names `jb@gymbusinessnews.com` as contact_email |
| 4 | **Mailchimp audience** named exactly `Gym Business News`, plus the **`news.gymbusinessnews.com` sending domain** verified and authenticated | ☐ | Must match the child's `mailchimp_audience` exactly (it is set explicitly in functions.php). Then store the mailchimp credential and let the probe go green |
| 5 | **GA4 property + Search Console** | ☐ | GA4 property named "Gym Business News"; verify it BY NAME via the Admin API, never from the console URL. `sc-domain:gymbusinessnews.com` in GSC; grant the service account on both; store the google_analytics credential. Site Kit tags with a `GT-` ID, so grepping for `G-` false-negatives |
| 6 | **LinkedIn company page** | ☐ | The longest-outstanding item on every tracker. Never guess the URL: `linkedin_url` stays unset in the child until the page exists and is verified as ours |
| 7 | **Name the title's owner and byline person** | ☐ **decision** | Five people split the wave's sponsorship and this title's owner is not confirmed. The child's `cogent_author_slug` is a `james-burke` placeholder and `Site.authorName` is null. Whoever it is, create the WP user with the right nicename BEFORE the theme deploy (playbook §3) |
| 8 | **Advertiser gate**: the owner names real, reachable advertisers in writing | ☐ | Same gate as every title. Start from Elevate 2026's exhibitors (software, payments, insurance, education first: the small-operator spenders) and the Barbering Business crossover (Vagaro, Fresha, Mindbody, Zenoti, Ripe *(which of these we already talk to is unverified)*) |

## Engine-side (Claude): runs in parallel with DNS

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 18 Sep | **45 verified feeds** in `docs/gym-business-news-sources.md` (24 policy/regulator/sector body, 9 sector and business press incl. 3 competitor-flagged, 3 press-release wires, 9 software/equipment/developer) plus 49 hub-only rows. Seed: `scripts/seed-gym-business-news-sources.mjs` (NOT run). ukactive, HCM and Gym Owner Monthly have no usable feed |
| B | Content plan `scripts/batch-plan-gym-business-news.json` | ✅ 18 Sep | 12 briefs, 3 waves, each aimed at a SERP checked on 18 Sep and found vendor- or broker-owned. Every brief carries a SOURCE ANCHORS block (facts pre-verified at primary source, dated) and STRUCTURAL REQUIREMENTS. **Canonical section list (the Site row must be created with exactly these):** News · Start & Grow · Money & Compliance · Members & Marketing · Tech & Software · Equipment & Fit-Out · People & PTs · Franchise & Deals |
| C | Search set | ✅ proposed 18 Sep, **not in lib/** | `GYM_BUSINESS_NEWS_SEARCHES` below, 13 queries, each tested against Google News RSS on 18 Sep. Needs the SHARED edits in "Shared changes needed" to go live |
| D | Title seed `scripts/seed-gym-business-news-title.mjs` | ✅ written, dry-run only | Engine OFF, status setup, $5/day cap, target 3/day, markets `["GB","US"]`, newsletter/LinkedIn/outreach OFF, authorEmail `news@news.gymbusinessnews.com`, 8 sections. Brief text in `scripts/alignment/gym-business-news.{editorial-standard.md,house-style.md,audience.txt}`. `--dry-run` passed 18 Sep (read-only: confirmed no `gym-business-news` row exists) |
| E | Child theme `gym-business-news-website/child` | ✅ scaffold 18 Sep | Power magenta `#B0185E` / bright `#EC4A8F` on iron `#16181B`, chalk surface `#F5F3F4`; Bebas Neue display face (single 400 weight, OFL licence shipped; the child corrects the parent's faux-bold heading weights), JetBrains Mono. Moved off orange and Barlow Condensed on 18 Sep after the coordinator reported both taken by Smart Farming News; distinct from all nine titles. Declares `cogent_brand` (incl. `mailchimp_audience` = "Gym Business News"), `cogent_home_sections`, `cogent_author_slug` (placeholder), 8 section patterns, nav, home template. No calculators, no GA4 filter yet. Local git repo, one commit, no remote |
| F | Editorial rules | ✅ proposed below | Scope rule + claims rule as a section ready to paste into `docs/editorial-standard.md`. The same text (expanded) is already in the alignment file the Site row reads |
| G | Title in `TITLES` + `CHILDREN` in `cogent-base-theme/scripts/check-title-agnostic.mjs` | ☐ SHARED | Must be added before the sweep can see this child |
| H | Keyword collision check | ✅ 18 Sep | Read-only query on `KeywordTarget`: no gym, fitness, PT, franchise or music-licence term is claimed by any live title. The only hit was a Smart SME wire item about a ninja gym opening. Re-check before commissioning waves 2-3 |
| I | Run the seeds (title, then sources, then searches) | ☐ | After the shared search-set edit lands. Order: title seed, `seed-gym-business-news-sources.mjs --site=gym-business-news`, `seed-news-searches.mjs --site=gym-business-news` |
| J | WordPress provisioning | ☐ | Yoast BEFORE the first publish; Engine user at editor with an application password; byline user at author with the right nicename; Sample Page deleted; permalinks `/%postname%/`; timezone Europe/London |
| K | Theme deploy, activate, `wp option update template cogent-base`, purge | ☐ | Needs the SFTP credential, which needs the SiteGround site. Deploy with `--from=../gym-business-news-website/child` |
| L | Drawn masthead and favicon | ☐ | Add this title to `cogent-base-theme/scripts/brand/specs.mjs` (Bebas Neue is already in its fonts folder), build, `install.mjs`. Then `set-publisher-logo.mjs --site=gym-business-news` and `build-brand-palettes.mjs` so newsletters and outreach take this palette |
| M | Private GitHub repo for the site folder | ☐ JB | Local repo exists; creating the remote was out of scope. Create it private, empty, and prove it with an anonymous curl (404) |
| N | Pre-flight (playbook §4) then `verify-title.mjs --site=gym-business-news` | ☐ | Must be all PASS before the engine goes on |

## C. Proposed search set (paste into `lib/news-searches.js`)

Tested 18 Sep 2026 against Google News RSS (`scratchpad/gym/check-gnews.mjs`).
Counts are items in the last 7 days; usability judged from headlines. Two
cautions: this was National Fitness Day week (16-17 Sep), which inflates the
GB sector-body count, and the closures count is inflated by one Singapore
chain collapse. Realistic supply after dedupe: roughly 7-9 usable a day
globally, 3-4 UK, which is why `articlesPerDayTarget` is 3.

| Query | Locale | Last 7d | Usable (judged) |
|---|---|---|---|
| Openings | GB | 12 | ~6 |
| Closures and failures | GB | 50 | ~15 (one international collapse dominates) |
| UK operators, results and deals | GB | 19 | ~10 |
| Fitness franchise deals | US | 12 | ~10 |
| Fitness M&A and funding | US | 5 | 5 |
| Gym software and platforms | US | 5 to 27 (varied across runs) | ~4 to 8 |
| Commercial equipment | GB | 8 | ~4 |
| Sector bodies and policy | GB | 11 | ~7 |
| Rates, tax and costs | GB | 32 | ~28 items but only ~4 distinct stories (Welsh rates relief) |
| Membership, pricing and retention | GB | 10 | ~7 |
| Leisure contracts and investment | GB | 26 | ~15 |
| Fitness industry data | US | 13 | ~6 |
| Personal trainers and careers | US | 16 | ~5 |

**Tested and rejected:** a fitness appointments query (41 items, ~3 usable:
Google treats bare "fitness" and "gym" loosely against "appoints"), a HYROX and
boutique-trends query (38 items, almost all one consumer incident story), a GB
gym-software query (~3 of 24 usable) and a GB PT-workforce query (3 to 6 items).
The PT and start-up beats have no wire, as the brief predicted; they are
plan-fed.

**Why `when:7d` comes FIRST in every query below.** On 18 Sep, Google News
silently dropped the `when:7d` operator from any query longer than roughly 200
characters and returned relevance-sorted results from all time instead. The
same query with `when:7d` moved to the front returned only fresh items. See
"Shared changes needed": this affects live titles too.

```js
/**
 * Gym Business News: the business of fitness for small operators.
 *
 * THE SCOPE RULE (docs/editorial-standard.md): we cover the business of
 * fitness, never the practice of it. If a query would return something a gym
 * member wanting a workout would read, it is wrong. Never seed bare "gym",
 * "fitness", "workout", "personal trainer" or "HYROX".
 *
 * `when:7d` LEADS every query deliberately. Tested 18 Sep 2026: Google News
 * drops a trailing `when:7d` once a query passes roughly 200 characters and
 * returns all-time results, which the ingester's age cutoff then discards, so
 * the search reads as a quiet week. Keep the exclusion block short for the
 * same reason.
 *
 * Deliberate absences: Start & Grow has no wire query (the PT and start-up
 * beats have no news supply; they are fed by the content plan), and there is
 * no appointments query (tested: ~3 usable in 41).
 *
 * `category` must match a section on the site. The section list is defined in
 * scripts/seed-gym-business-news-title.mjs and the content plan, and these must
 * stay in lockstep.
 */
// Exclusions thin the consumer noise; they do not remove it. The scope rule is
// the actual guard, and the Researcher enforces it.
const NO_WORKOUT = '-workout -"weight loss" -diet';

export const GYM_BUSINESS_NEWS_SEARCHES = [
  {
    name: "Wire: gym and studio openings",
    category: "News",
    locale: "GB",
    query: `when:7d ("new gym" OR "gym opens" OR "gym to open" OR "gym opening" OR "fitness studio opens" OR "new fitness studio" OR "health club opens" OR "24-hour gym") ${NO_WORKOUT} -school`,
  },
  {
    // Openings and closures is the strongest format signal in the fleet's data.
    name: "Wire: gym closures and failures",
    category: "News",
    locale: "GB",
    query: `when:7d (gym OR "fitness studio" OR "health club" OR "gym chain") (closes OR closure OR "to close" OR administration OR administrators OR liquidation) -school`,
  },
  {
    // Every chain story answers one question for the reader: what does this
    // change for an independent? (the small-operator rule).
    name: "Wire: UK operators, results and deals",
    category: "Franchise & Deals",
    locale: "GB",
    query: `when:7d (PureGym OR "The Gym Group" OR "David Lloyd Leisure" OR "David Lloyd Clubs" OR "Anytime Fitness" OR "Virgin Active" OR "Basic-Fit" OR "Everyone Active" OR "Nuffield Health" OR "JD Gyms" OR "Snap Fitness" OR "Third Space")`,
  },
  {
    name: "Wire: fitness franchise deals",
    category: "Franchise & Deals",
    locale: "US",
    query: `when:7d ("fitness franchise" OR "gym franchise" OR "boutique fitness" OR "fitness franchisee") (franchise OR franchisee OR "development agreement" OR units OR studios OR expansion OR signs)`,
  },
  {
    name: "Wire: fitness M&A and funding",
    category: "Franchise & Deals",
    locale: "US",
    query: `when:7d ("fitness company" OR "gym chain" OR "health club" OR "fitness brand" OR "fitness operator" OR "boutique fitness") (acquires OR acquisition OR raises OR "funding round" OR "private equity" OR merger)`,
  },
  {
    // "Xplor" is deliberately absent: it collides with a mining investor event.
    name: "Wire: gym software and platforms",
    category: "Tech & Software",
    locale: "US",
    query: `when:7d ("gym software" OR "gym management" OR "fitness software" OR Mindbody OR "ABC Fitness" OR Glofox OR Daxko OR EGYM OR Wellhub OR Hapana OR WellnessLiving) (launches OR partnership OR acquires OR funding OR integration OR partners OR AI)`,
  },
  {
    // "Keiser" is deliberately absent: it returns a university's sports news.
    name: "Wire: commercial equipment",
    category: "Equipment & Fit-Out",
    locale: "GB",
    query: `when:7d (Technogym OR "Life Fitness" OR "Matrix Fitness" OR Precor OR Freemotion OR "Escape Fitness" OR Eleiko OR "Hammer Strength") (operator OR operators OR club OR clubs OR partnership OR launches OR supplier) -review -best`,
  },
  {
    name: "Wire: sector bodies and policy",
    category: "News",
    locale: "GB",
    query: `when:7d (ukactive OR CIMSPA OR "fitness sector" OR "physical activity sector" OR "leisure operators" OR "Health and Fitness Association")`,
  },
  {
    name: "Wire: rates, tax and costs",
    category: "Money & Compliance",
    locale: "GB",
    query: `when:7d (gym OR gyms OR "fitness industry" OR "leisure centres" OR "leisure operators") (VAT OR "business rates" OR HMRC OR "energy costs" OR "minimum wage" OR "national insurance" OR subscription OR CMA OR "consumer law")`,
  },
  {
    name: "Wire: membership, pricing and retention",
    category: "Members & Marketing",
    locale: "GB",
    query: `when:7d (gym OR gyms OR "health club" OR "fitness studio" OR "fitness industry") ("membership prices" OR "price rise" OR retention OR churn OR "membership numbers" OR "record members" OR "members rise") ${NO_WORKOUT}`,
  },
  {
    // Council leisure refurbishments are where fit-out and equipment budgets go.
    name: "Wire: leisure contracts and investment",
    category: "Equipment & Fit-Out",
    locale: "GB",
    query: `when:7d ("leisure centre" OR "leisure centres" OR "leisure trust") (contract OR operator OR council OR investment OR refurbishment OR gym) (million OR £)`,
  },
  {
    name: "Wire: fitness industry data (US)",
    category: "News",
    locale: "US",
    query: `when:7d ("fitness industry" OR "health club industry" OR "gym industry") (revenue OR operators OR report OR membership OR clubs OR survey) ${NO_WORKOUT}`,
  },
  {
    name: "Wire: personal trainers and careers",
    category: "People & PTs",
    locale: "US",
    query: `when:7d ("personal trainers" OR "personal training" OR "fitness coaches" OR "fitness professionals") (business OR income OR certification OR "gym owners" OR employed OR independent OR pay) ${NO_WORKOUT}`,
  },
];
```

## F. Per-title rules (paste into `docs/editorial-standard.md` under "Per-title rules")

```md
### Gym Business News: two rules

**1. The scope rule.** We cover the *business* of fitness, never the
*practice* of it. Every article is written for someone who carries the lease,
the payroll or the direct-debit book: independent gym and studio owners,
self-employed personal trainers running their own business, and franchisees.
If the natural reader is someone who wants to get fitter, it is not our
article.

No training advice, no programmes, no nutrition or supplement guidance, no
treatment efficacy (recovery, sauna, cold water, wearables are revenue lines we
can cover, not therapies we can assess). Weight-loss drugs are a live sector
story: GLP-1 is covered only as a business and liability story (what it does
to demand, what an operator may say or offer, who carries the risk), never how
the drugs work or who should take them. This is a commercial rule as much as a
safety one: almost every term here has a consumer twin ("gym near me" runs at
roughly 100,000 searches a month), and health advice is YMYL ground a new
domain with no named clinician cannot win. The engine is never seeded with a
bare "gym", "fitness", "workout" or "personal trainer" query; the safe stems
live in the title's search set.

Trends are in scope through the till: what a trend does to the timetable, the
price list and the kit budget, never how to do it.

**2. The claims rule.** Every health, results, savings or performance claim is
attributed to the party making it and never asserted in our voice. That covers
supplier payback claims, vendor churn and retention statistics, and anything
from a press release. Vendor content owns most of this sector's search results
and many of its most-repeated statistics ("the average member stays 4.7
months") have no traceable primary source: if a figure cannot be traced to a
named report, survey or filing, it does not run. UK market totals are
attributed to the UK Health and Fitness Market Report (ukactive with 4GLOBAL,
Sport England and Grant Thornton) every time, and US figures are never blended
with UK ones.
```

## Shared changes needed (not made; each goes through THE RULE)

1. **`lib/news-searches.js`: add `GYM_BUSINESS_NEWS_SEARCHES`** (block C above).
   **`scripts/seed-news-searches.mjs`: add `"gym-business-news":
   GYM_BUSINESS_NEWS_SEARCHES` to `SEARCH_SETS`** and to its import list.
2. **`when:7d` is silently dropped on long queries, and this hits live titles
   today.** Measured 18 Sep 2026: Barbering's live openings query (with
   `NO_HAIRCUT`) returned 78 items and **0** from the last 7 days, twice; the
   same query without the exclusion block returned only fresh items. Airport's
   expansion query (with `NO_PAX`) returned 100 items of which only 26 were
   fresh. The threshold across 32 test queries was about 200 characters, and
   moving `when:7d` to the FRONT of the query restored the filter every time.
   `lib/feeds.js` discards items older than `MAX_AGE_DAYS`, so an affected query
   does not fail: it just looks like a quiet week, which is the §7 failure mode.
   Two fixes, pick one: (a) in `searchFeedUrl()`, hoist any `when:` operator to
   the start of the query (one line, fixes every set at once, but it changes the
   URL of every existing search row, so reseed or migrate `feedUrl`s); or
   (b) edit each set's queries to lead with `when:7d`. Either way, sweep every
   title's searches for "items returned but none fresh" afterwards.
3. **`cogent-base-theme/scripts/check-title-agnostic.mjs`: add this title to
   `TITLES` and the child to `CHILDREN`** before running the sweep.
4. **`docs/editorial-standard.md`: paste block F** under "Per-title rules".
5. **`lib/reachability.js`** has no fitness coverage. Before outreach is ever
   switched on (after ~20 published articles), add the sector's obvious
   non-responders (the big chains' head offices and the largest equipment
   brands) so the title does not start by emailing household names.
6. **`cogent-base-theme/scripts/brand/specs.mjs`**: add this title's drawn
   mark (step L).

## Open questions / watch list

- **Who owns this title** (step 7): it decides the byline, the LinkedIn owner
  and the advertiser gate.
- **Name collision check** *(not done by design; no trademark searches were
  run)*. "Gym Business News" has not been screened; JB's call whether to check
  from a phone, as with earlier titles.
- **Gym Owner Monthly and WellNation** are live and weak (brief R1); Athletech
  News (US, Tranco ~248k) out-publishes everyone on deals. Win on search and
  small-operator money guides, not on news speed.
- **The DMCC subscription regime starts January 2027** (government
  announcement, 9 Aug 2026). It is this title's biggest recurring compliance
  story for the next six months, and wave 3 carries the explainer. Watch the
  CMA and DBT feeds for the secondary legislation and guidance.
- **US skew.** Half the usable wire is US franchise and deal flow. It matters
  to a UK owner as trend signal; the UK money and compliance evergreen is the
  backbone. Watch that the News section does not fill with US franchise
  signings.
- **Newsletter floor**: ten articles with images before the newsletter can be
  armed; at 3 a day plus the 12-brief plan that is roughly day 4 or 5 after
  the engine goes on.
- **Advertiser rows** in the brief marked *(unverified)* need one confirmation
  pass before any sales deck.
- **No calculators at launch.** Candidates if the search data asks: a
  cost-to-open estimator and a member-value or pricing calculator (both map to
  wave 1 and 3 pillars).
