# Senior Lifestyle Business: launch tracking

The retirement communities title, one of the five-title wave announced 18 Sep
2026. Domain **seniorlifestylebusiness.com**, bought 18 Sep 2026 at GoDaddy,
.com only (no .co.uk). Vertical case: `docs/vertical-brief-retirement-villages.md`
(61/100, conditional yes). Process: `docs/new-title-playbook.md`; this file
tracks this title's run through it.

Slug: **`senior-lifestyle-business`**. Session prefix: 🏡 SENIOR. Project
folder: `senior-lifestyle-business-website`.

**The name is not settled.** "Senior Lifestyle" is also the trading name of
Senior Lifestyle Corporation (Chicago), a large US senior living operator, and
the name was never checked against the brief's naming section (which
recommended retirementvillagebusiness.com). Everything below is built so that a
rename touches as few places as possible: the seed's `name`, `markPrimary` and
`markAccent`; the child theme's `$name` in `cogent_brand`, `style.css` Theme
Name and the masthead lockup in `parts/header.html`; and the Mailchimp audience
name. Slug, folder and file names stay as they are.

---

## JB's critical path (starts the clock; nothing downstream moves without #3)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **Decide the name** | ☐ | See above. Decide before the masthead goes public and before the Mailchimp audience is created, because the audience name must equal `mailchimp_audience` exactly |
| 2 | **Register domains** | ✅ partial, 18 Sep | .com bought at GoDaddy. No .co.uk: a UK-led title without its .co.uk is exposed to anyone who takes it (~£10) |
| 3 | **Create the site at SiteGround**, then at GoDaddy point nameservers to `ns1/ns2.siteground.net` (that order, never the reverse) | ☐ | SSL only issues after DNS propagates; start this first. Then HTTPS Enforce on |
| 4 | **Google Workspace: add seniorlifestylebusiness.com as a SECONDARY domain** to the existing org; user `jb@seniorlifestylebusiness.com`; generate DKIM | ☐ | No `news@` user on the root (decision of 24 Aug 2026). Edit SiteGround's SPF in place to add `include:_spf.google.com`; never a second `v=spf1` |
| 5 | **Mailchimp audience** named exactly as the title (today: `Senior Lifestyle Business`), plus an authenticated **`news.seniorlifestylebusiness.com` sending domain** | ☐ | The child theme already sets `mailchimp_audience` to the name. The seed's `authorEmail` is `news@news.seniorlifestylebusiness.com` |
| 6 | **GA4 property + Search Console** (`sc-domain:seniorlifestylebusiness.com`), service account granted both | ☐ | Verify the GA4 property by NAME through the Admin API; the console URL shows the previously selected property |
| 7 | **LinkedIn company page** | ☐ | `linkedin_url` is deliberately unset in the child; the sidebar card renders nothing until it exists |
| 8 | **The Care Home Magazine publisher conversation** | ☐ **gate** | Brief §12 item 1: would CHM sell a joint later-life package, and which of its 350+ suppliers already ask about retirement villages? **If CHM sees this title as a competitor, stop**: the crossover is the case. Also agree the front-door rule with CHM's editor so both titles hold the same line |
| 9 | **Name the title owner and the byline person** | ☐ | The wave has no single sponsor per title. The child's `cogent_author_slug` is `james-burke` as a real-person placeholder; change it (and the seed's `authorName`) when the owner is named. Create the WordPress byline user with that exact nicename BEFORE deploying the theme (playbook §3) |
| 10 | **Care Home Magazine's domain onto the outreach exclusion list, and its ranking terms claimed in the keyword registry** | ☐ **before first article** | The brief records the domain as **carehomemagazine.co.uk**; its feed was live on 18 Sep 2026 (`/feed/`, newest item that day), but confirm it is the right property before listing it. Legacy titles are invisible to both guardrails today (see Shared changes, S5) |

## Engine-side (Claude): runs in parallel with DNS

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 18 Sep | **48 verified feeds** in `docs/senior-lifestyle-business-sources.md`: UK 28, AU 7, NZ 8, US 5. 10 competitor-flagged, 4 flagged "front-door filter" (care-weighted). 35 hub-only rows (ARCO, Housing LIN, Knight Frank and every large UK operator have no feed). Care Home Magazine's feed deliberately NOT seeded. Seed script `scripts/seed-senior-lifestyle-business-sources.mjs` written, **not run** (needs the Site row) |
| B | Content plan `scripts/batch-plan-senior-lifestyle-business.json` | ✅ 18 Sep | 12 briefs, 3 waves, each aimed at a SERP the brief measured as publisher-free (§3), each with pre-verified SOURCE ANCHORS and structural requirements. **Canonical section list (the site must be created with exactly these):** News · Development & Planning · Capital & Investment · Operators & Economics · Fees & Regulation · Sales & Marketing · Design & Amenities |
| C | Search set | ✅ proposed, ☐ shared edit | `SENIOR_LIFESTYLE_BUSINESS_NEWS_SEARCHES`, 14 queries, below. Needs adding to `lib/news-searches.js` and to `SEARCH_SETS` in `scripts/seed-news-searches.mjs` (shared: S1) |
| D | Title seed `scripts/seed-senior-lifestyle-business-title.mjs` | ✅ written, dry-run clean 18 Sep | Engine OFF, status `setup`, $5/day cap, target 3/day, markets `["GB","AU","NZ","US"]`, newsletter/LinkedIn/outreach OFF, sections locked, timezone Europe/London. Reads `scripts/alignment/senior-lifestyle-business.{audience.txt,editorial-standard.md,house-style.md}`. **Not run.** The dry-run's read found no existing row |
| E | Child theme `senior-lifestyle-business-website/child` | ✅ scaffold 18 Sep | Aubergine/heather/bronze palette on plum-black ink, Playfair Display display face (the only high-contrast serif among the titles), heather masthead chip, 7 section patterns, nav, home template. `git init -b main`, one commit, no remote. **Not deployed.** A drawn masthead from the brand kit waits for the name |
| F | `cogent_brand`, `cogent_home_sections`, `cogent_author_slug` in the child | ✅ 18 Sep | `mailchimp_audience` set to the name exactly; `linkedin_url` and `cogent_ga4_id` deliberately unset until JB steps 6 and 7 |
| G | Editorial standing rules for `docs/editorial-standard.md` | ✅ drafted, ☐ paste | Block below (shared file: S2). Also embedded in the seed's `editorialStandardMd` via the alignment file |
| H | Title in `TITLES` + `CHILDREN` in `cogent-base-theme/scripts/check-title-agnostic.mjs` | ☐ | Shared (S3) |
| I | Seed the Site row, sources and searches | ☐ | Order: title seed, then sources seed, then `seed-news-searches.mjs` once S1 lands. Scan cron ignores setup+engine-off titles, so live titles are untouched |
| J | WordPress: Yoast BEFORE first publish; Engine user (editor + app password); byline user | ☐ | After JB step 3 |
| K | Theme deploy (parent first if the host has never had it), `wp option update template cogent-base`, purge | ☐ | Also: Sample Page deleted, menu explicit, permalinks `/%postname%/` |
| L | Credentials stored + probes green (wordpress, mailchimp, google_analytics, sftp) | ☐ | |
| M | Tools pages | ✅ none at launch | Deliberate: the planned tools (pipeline tracker, C2/C3 appeal ledger, fee benchmark) are directory collections built once the archive has rows; wave 2 and 3 briefs are their seed pieces |
| N | Pre-flight checklist (playbook §4) | ☐ | |
| O | `verify-title.mjs --site=senior-lifestyle-business` all PASS, then engine ON and wave 1 | ☐ | |

---

## Block C: the proposed search set (for `lib/news-searches.js`)

Measured 18 Sep 2026 against Google News RSS in the GB, AU and US editions;
counts are items actually dated within the last 7 days. "Usable" is my read of
each title against the front-door and operator rules. **Caveat: this was the
week of the NZ repayment reform, which inflates every "retirement village"
query; expect roughly 30% less in a normal week** (the brief measured the same
effect).

Two findings worth carrying into the playbook:

1. **Google News silently drops `when:7d` on an over-complex query.** A
   14-alternative operator query returned 24 items, none from the last week;
   the same query with 8 alternatives returned 22, all current. The quoted
   exclusion block does the same to a query that is already long (the
   appointments query below returns 0 current items with it and 11 without).
   The failure looks like a working feed: plenty of items, all stale, and the
   ingester dedupes them away so it reads as a quiet week. Every query below
   was checked for this; see S6 for a shared guard.
2. **Locale matters only for named entities.** For generic phrases the GB, AU
   and US editions return 85 to 100% the same items (the brief's finding
   holds). For listed AU/NZ operator names the AU edition adds about 20% the GB
   edition misses, and for US capital and sales queries the US edition adds
   15 to 30%. So AU is used for the operator and land lease beats, US for
   capital and sales, GB elsewhere. An NZ edition would need a `LOCALES` entry
   (shared) and buys nothing measurable: NZ outlets already appear in GB/AU.

| # | Query | Locale | Items/7d | Usable | Other editions |
|---|---|---|---|---|---|
| 1 | UK later living | GB | 7 | ~70% | AU 6/7, US 6/7 shared |
| 2 | UK operators named | GB | 6 | ~70% | AU 6/6, US 5/6 |
| 3 | Appointments | GB | 11 | ~55% | AU 10/11, US 8/11 |
| 4 | Retirement village planning | GB | 33 | ~40% | AU 29/33, US 28/33 |
| 5 | Extra care and housing with care | GB | 5 | ~80% | AU 5/5, US 4/5 |
| 6 | Seniors housing (AU planning term) | AU | 8 | ~60% | GB 7/8, US 7/8 |
| 7 | UK and international capital | GB | 15 | ~60% | AU 12/15, US 11/15 |
| 8 | US capital markets | US | 50 | ~50% | GB 44/50, AU 46/50 |
| 9 | Land lease (AU) | AU | 10 | ~70% | GB 8/10, US 9/10 |
| 10 | Listed AU/NZ operators | AU | 27 | ~60% | GB 22/27, US 25/27 |
| 11 | Operator economics | AU | 7 | ~70% | identical in all three |
| 12 | AU/NZ regulation | AU | 23 | ~80% | GB 18/23, US 21/23 |
| 13 | UK fees and regulation | GB | 6 | ~50% | AU 5/6, US 5/6 |
| 14 | Sales and occupancy | US | 28 | ~55% | GB 19/28, AU 23/28 |

Heavy overlap between queries (the NZ reform cluster appears in six of them),
so the sum is not the supply. De-duplicated, roughly 6 to 8 usable items a day
including US capital, about 3 to 4 without it, and about 1.5 UK-only: the
brief's finding stands, and the AU/NZ leg is load-bearing.

Tested and dropped: a C2/C3 query (0 items in 30 days; the gov.uk `"use class
C2"` Atom feed in the source list does this job), and a design and amenities
query (15 items, about 25% genuinely design, the rest duplicates of other
beats). **Design & Amenities therefore has no wire query, deliberately**: it is
fed by the content plan and by The Architects' Journal and Pozzoni feeds, the
same pattern an earlier title uses for its plan-fed section.

```js
/**
 * Senior Lifestyle Business: UK-led, AU/NZ second, US capital only.
 *
 * The retirement community as a business (docs/vertical-brief-retirement-villages.md).
 * Measured 18 Sep 2026 in GB, AU and US editions (docs/senior-lifestyle-business-launch.md).
 * NEVER seed the bare queries `retirement village`, `senior living`,
 * `later living`, `extra care` or `care home` (brief §4): the raw feeds are
 * 25-45% usable and drift to residents' birthdays, obituaries and crime.
 *
 * THE FRONT-DOOR RULE (docs/editorial-standard.md): if the resident has their
 * own front door and a lease, licence or tenancy, it is ours; a room and a care
 * plan in a CQC-registered care home belongs to CIM's Care Home Magazine. No
 * query here may contain a care-home term except as an exclusion.
 *
 * QUERY LENGTH. Google News silently drops `when:7d` from an over-complex
 * query and returns up to 100 stale items. Every entry below was checked for
 * it. Adding alternatives or exclusions to any of them means re-checking that
 * the items are still dated within the week.
 *
 * LOCALES. Per beat: AU for AU/NZ operator names and land lease, US for
 * capital and sales, GB elsewhere. Generic phrases return the same items in
 * every edition.
 *
 * Deliberate absence: no wire query feeds "Design & Amenities" (measured ~25%
 * usable); it is plan-fed.
 *
 * `category` must match a section on the site. The section list is defined in
 * scripts/seed-senior-lifestyle-business-title.mjs and the content plan, and
 * these must stay in lockstep.
 */
// Exclusions thin the care-home layer; they do not remove it (negative
// operators match the article body and leak). Measured cost: 10-15% of items
// on most queries, 60% on the extra care query (so it runs without), and it
// breaks the appointments query outright (so that runs without too). The
// front-door rule is the actual guard, and the Researcher enforces it.
const NO_CARE_HOME = '-"care home" -"care homes" -"nursing home" -"nursing homes"';

export const SENIOR_LIFESTYLE_BUSINESS_NEWS_SEARCHES = [
  {
    name: "Wire: UK later living",
    category: "News",
    locale: "GB",
    query: `"later living" (scheme OR developer OR operator OR homes OR investment OR planning) ${NO_CARE_HOME} when:7d`,
  },
  {
    // Eight names is the ceiling: fourteen dropped when:7d (see QUERY LENGTH).
    // Bare "Beechcroft" and "Lifestory" match schools and 5K runs; keep them out.
    name: "Wire: UK operators",
    category: "News",
    locale: "GB",
    query: `("McCarthy Stone" OR "McCarthy & Stone" OR "Audley Group" OR "Inspired Villages" OR "Retirement Villages Group" OR "Rangeford Villages" OR "Churchill Retirement") when:7d`,
  },
  {
    // The Movers column. No exclusion block: it breaks this query.
    name: "Wire: appointments",
    category: "News",
    locale: "GB",
    query: `("later living" OR "retirement village" OR "retirement living" OR "retirement housing" OR "senior living") (appoints OR appointed OR "joins as" OR "named as") when:7d`,
  },
  {
    name: "Wire: retirement village planning",
    category: "Development & Planning",
    locale: "GB",
    query: `"retirement village" (planning OR approved OR consent OR appeal OR council) ${NO_CARE_HOME} when:7d`,
  },
  {
    // No exclusion block: extra care schemes sit beside care homes in the copy,
    // and excluding them cost 3 of 5 usable items. The front-door rule decides.
    name: "Wire: extra care and housing with care",
    category: "Development & Planning",
    locale: "GB",
    query: `("extra care housing" OR "extra care scheme" OR "extra care facility" OR "extra care development" OR "housing with care") when:7d`,
  },
  {
    // "Seniors housing" is the NSW planning term (SEPP), so this is the AU
    // development pipeline: exhibitions, DAs and approvals.
    name: "Wire: seniors housing proposals (AU)",
    category: "Development & Planning",
    locale: "AU",
    query: `"seniors housing" (proposal OR exhibition OR "development application" OR approval OR approved OR planning) ${NO_CARE_HOME} when:7d`,
  },
  {
    name: "Wire: capital, funding and acquisitions",
    category: "Capital & Investment",
    locale: "GB",
    query: `("later living" OR "retirement living" OR "retirement village") (funding OR investment OR loan OR facility OR acquisition) ${NO_CARE_HOME} when:7d`,
  },
  {
    // US capital markets only: REIT and platform deals that move UK money, and
    // benchmarks. US operator news is Senior Housing News's ground, not ours.
    name: "Wire: US senior housing capital markets",
    category: "Capital & Investment",
    locale: "US",
    query: `("senior housing" OR "seniors housing" OR "senior living") (acquisition OR acquires OR financing OR portfolio OR REIT) -"skilled nursing" -"nursing home" when:7d`,
  },
  {
    name: "Wire: land lease communities (AU)",
    category: "Capital & Investment",
    locale: "AU",
    query: `"land lease" (community OR communities OR lifestyle) (developer OR operator OR acquisition OR approval OR takeover) when:7d`,
  },
  {
    // "Ryman Healthcare", never bare Ryman: the bare word returns Nashville's
    // Ryman Auditorium and a US hotel REIT.
    name: "Wire: listed AU/NZ operators",
    category: "Operators & Economics",
    locale: "AU",
    query: `("Ryman Healthcare" OR Summerset OR "Oceania Healthcare" OR Arvida OR Metlifecare OR Aveo OR Ingenia OR GemLife) (village OR retirement OR "land lease" OR results) when:7d`,
  },
  {
    name: "Wire: operator economics",
    category: "Operators & Economics",
    locale: "AU",
    query: `"retirement village" (operator OR developer) (profit OR results OR occupancy OR sales OR earnings) ${NO_CARE_HOME} when:7d`,
  },
  {
    // The resident-harm rule applies to everything this returns: repayment
    // waits and fee rulings are regulatory risk to operators, never a
    // resident's story, and no private resident is ever named.
    name: "Wire: AU/NZ village law and fees",
    category: "Fees & Regulation",
    locale: "AU",
    query: `"retirement village" (law OR bill OR reform OR repayment OR "Retirement Commissioner" OR tribunal OR ACCC) ${NO_CARE_HOME} when:7d`,
  },
  {
    name: "Wire: UK event fees and older people's housing policy",
    category: "Fees & Regulation",
    locale: "GB",
    query: `("event fees" OR "exit fees" OR "older people's housing" OR "retirement housing" OR "later living") (government OR consultation OR taskforce OR regulation OR NPPF OR leasehold) when:7d`,
  },
  {
    name: "Wire: sales, occupancy and marketing",
    category: "Sales & Marketing",
    locale: "US",
    query: `("retirement village" OR "retirement living" OR "later living" OR "senior living") ("sales director" OR "marketing director" OR "sales and marketing" OR occupancy OR "move-ins" OR "sold out") when:7d`,
  },
];
```

And in `scripts/seed-news-searches.mjs`: import it and add
`"senior-lifestyle-business": SENIOR_LIFESTYLE_BUSINESS_NEWS_SEARCHES` to
`SEARCH_SETS`.

---

## Block F: standing rules for `docs/editorial-standard.md`

Paste as a per-title section, in the same shape as the other titles' sections.
The same text, expanded, is the title's `editorialStandardMd` via
`scripts/alignment/senior-lifestyle-business.editorial-standard.md`.

```markdown
## Senior Lifestyle Business: five rules

The retirement community as a business, UK-led with Australia and New Zealand
second and US capital as the benchmark.

**The front-door rule (scope, and the line with Care Home Magazine).** If the
resident has their own front door and holds a lease, licence or tenancy, the
story is ours: retirement villages, integrated retirement communities, extra
care, assisted living, housing with care, retirement housing. If the resident
has a room and a care plan in a CQC-registered care home, it belongs to CIM's
Care Home Magazine and we do not write it. Care home development, planning and
deals, CQC inspections and ratings, and the care workforce all stay with Care
Home Magazine. On a mixed campus we cover the development, the capital and the
village operation, never the care home's operation, ratings or staffing.
Domiciliary care inside a village is an operating model and a cost line only.
In Australia "aged care" means residential care and sits on the other side of
the line. We never target a search query containing "care home", "nursing home"
or "residential care"; Care Home Magazine never targets "retirement village",
"retirement community", "later living" or "extra care". The two titles are sold
together, never against each other.

**The operator rule.** Every article is written for someone paid to develop,
fund, run, design, supply or regulate a retirement community: operator,
developer, investor, lender, planner, architect, council commissioner, adviser,
supplier. If the natural reader is a resident or their family, it is not our
article. No "how to choose a retirement village", no "is it worth it", no fee
explainers written for buyers. Resident complaints are regulatory and
reputational risk to operators, never advice to residents.

**The no-advice rule.** No financial, legal or care advice to consumers. Event
fees and deferred management fees are explained from the operator's P&L;
planning law is described and the reader is pointed to counsel. Retirement
finance for older people is a textbook YMYL topic.

**The resident-harm rule.** Insolvencies, fee rulings, tribunal decisions and
regulation are business and regulatory risk, and we cover them as such. We do
not cover individual deaths, abuse, crime or safety incidents as news, and we
never name a private resident.

**The scope-and-figure rule.** "Senior housing", "integrated retirement
community" and "retirement housing" are different stock and their numbers
differ by definition. ARCO's investment and turnover projections and operators'
savings claims are advocacy figures. Every figure carries source, year and
scope, or is quoted as a range with the sources named; never an ARCO or
operator claim in our own voice.
```

---

## Shared changes needed (not made; each goes through THE RULE)

| # | File | Change | Why |
|---|---|---|---|
| S1 | `lib/news-searches.js`, `scripts/seed-news-searches.mjs` | Add Block C and register it in `SEARCH_SETS` | The wire |
| S2 | `docs/editorial-standard.md` | Paste Block F | The rules every agent reads |
| S3 | `cogent-base-theme/scripts/check-title-agnostic.mjs` | Add this title to `TITLES` and `CHILDREN` | Or the sweep never checks this child |
| S4 | `lib/agents/researcher.js` (`SUGGEST_EDITIONS`) and `scripts/batch-publish.js` (`MARKET_NAMES`, `marketsPhrase`) | Add `NZ: "hl=en-NZ&gl=nz"` and `NZ: "New Zealand"`; make `marketsPhrase` join a list of more than two as "the UK, Australia, New Zealand and the US" | This is the first title with four markets and the first with NZ. Today NZ falls back to the GB autocomplete edition (a duplicate query, harmless) and prints as "NZ" in drafting prompts, and four markets render as "the UK and Australia and NZ and the US". Nothing breaks; the prompts read worse. Check the other wave titles' markets at the same time |
| S5 | Keyword registry and outreach exclusion list | A way to register a LEGACY title's domain (carehomemagazine.co.uk) as excluded from outreach, and its ranking terms as claimed, when it has no Site row | The registry holds rows per fleet Site only, so Care Home Magazine's terms read as free and the backlink engine can draft to its domain. This is the CIM legacy-titles gap; this title is the first where it bites before launch. The DB currently holds no KeywordTarget rows containing retirement, later living, senior, extra care, nursing or care home terms for any title (read-only check, 18 Sep 2026), so there is no collision among the live titles |
| S6 | `scripts/seed-news-searches.mjs` (or the scan) | Warn when a search's items are mostly older than its `when:` window, and fix the live queries that trip it | The silent `when:7d` drop (Block C, finding 1) **is already happening on the live titles.** A read-only run on 18 Sep 2026 of all 71 queries in `lib/news-searches.js` found **18 returning mostly stale items**: airport 8 of 19 (e.g. "non-aero revenue and concessions" 51 items, 0 from the last week; "technology rollouts" 74, 0), golf 5 of 15, barbering 3 of 12, fleet 1 of 13, Smart SME 1 of 12. Those beats are getting little or no fresh wire while looking healthy. One snapshot, so re-run before acting; the fix is usually fewer alternatives per group or dropping the exclusion block |
| S7 | `lib/reachability.js` | Add this vertical's obvious non-responders before outreach is ever enabled | No coverage for any new vertical today (playbook §12) |

---

## Open questions and watch list

- **The name** (above), and with it the drawn masthead, the Mailchimp audience
  name and the LinkedIn page name. All wait on one decision.
- **The Care Home Magazine conversation is a gate, not a courtesy** (JB step 8).
  Also confirm carehomemagazine.co.uk is CHM's live domain; the brief says so
  and its feed is live, but the task that commissioned this file did not know it.
- **Title owner** from the five-person wave split: nobody is named for this
  title. The brief asks whether anyone at CIM has operator or ARCO
  relationships; without one, the advertiser gate (named, reachable
  advertisers) has no owner.
- **Older People's Housing Taskforce chair** *(unverified)*: the brief names
  Prof Julienne Meyer; Housing LIN's announcement page, fetched 18 Sep 2026,
  foregrounds Jeremy Porteus. The content plan deliberately names no chair.
- **The "~5.5% prime senior living yield" in the brief** could not be
  re-verified from its cited source on 18 Sep 2026 *(unverified)*; the content
  plan forbids quoting a UK yield unless attributed and linked at draft time.
- **Ahrefs, one month** (brief §12): the B2B search volumes here are probably
  small; the traffic case may rest on the trackers.
- **Wire supply was measured in the NZ reform week.** Re-measure in a quiet
  week before raising `articlesPerDayTarget` above 3.
- **newsrooms.js candidates**, in order of value: ARCO, Housing LIN, Knight
  Frank research. Three hand-verified scrapers would add the UK's most
  important voices, none of which has a feed.
- **Playfair Display ships as a 300 KB variable TTF** (copied from the brand
  kit, SIL OFL, licence file included). Subsetting to woff2 is a design-pass
  job.
- **Palette clash within the wave**: checked 18 Sep 2026 against all nine
  other children. The wave siblings are teal (dental), magenta (gym),
  amber-brown (nurseries) and orange (farming); none is near aubergine, and
  nursery-daily's Zilla Slab is the only other serif (a slab, not a
  high-contrast face). Still worth one side-by-side look before deploys.
- Newsletter, LinkedIn and outreach are all seeded OFF. Outreach waits for ~20
  published articles, a real Workspace mailbox and S5 and S7.
