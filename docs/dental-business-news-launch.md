# Dental Business News: launch tracking

One of the five titles in the 18 Sep 2026 wave. Name chosen by JB 18 Sep 2026:
**Dental Business News**, UK-only, `markets: ["GB"]`. Vertical case:
`docs/vertical-brief-dental.md` (calibrated score 55/100, the lowest of the
wave, conditional on a narrow seam and one named advertiser). Process:
`docs/new-title-playbook.md`; this file tracks *this* title's run through it.

Slug: **`dental-business-news`**. Session prefix: 🦷 DENTAL. Project folder:
`dental-business-news-website`. Domain: **dentalbusinessnews.com only** (bought
at GoDaddy 18 Sep 2026; the .co.uk was not bought).

**The seam, which is the whole case.** Not generic practice management, which
FMC's Dentistry.co.uk owns. The practice as an asset, built on data: a UK
dental deals and groups tracker (practice sales and group deals never reach
Google News), NHS contract values and handbacks by area from NHSBSA open data,
practice openings and closures from CQC registrations, and a private
conversion index.

---

## JB's critical path (starts the clock: nothing downstream moves without #2)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **The brief's gate: one named advertiser that buys an owner audience** | ☐ | Brief §12.2. There is no CIM book for dentistry (no legacy title), so this is the commercial gate, same as Tom's answers for airports. Target the owner-buying layer, not the clinical-product money: a broker (Christie & Co, Frank Taylor, Dental Elite, PFM Dental), a plan provider (Practice Plan, Denplan), a software vendor (Software of Excellence, Dentally), a lender (Braemar, Wesleyan) or a specialist accountant (NASDAL members). Which of the five wave owners carries this title is also still open |
| 2 | **Create the site at SiteGround** (dentalbusinessnews.com), THEN point GoDaddy nameservers to `ns1/ns2.siteground.net` | ☐ | That order, never the reverse. Then wait for DNS and Let's Encrypt, and switch **HTTPS Enforce** on (a valid cert alone is not enough) |
| 3 | **Check the new site's WAF against the `<TitleName>Bot` user-agent** | ☐ | Barbering's site 403'd it; Airport's did not. One curl after SSL |
| 4 | **Google Workspace: add dentalbusinessnews.com as a SECONDARY domain** to the existing org; user `jb@dentalbusinessnews.com`; generate DKIM; edit SiteGround's SPF in place to add `include:_spf.google.com` | ☐ | Never a new Workspace. The child theme's `contact_email` and footer already point at `jb@dentalbusinessnews.com`, so this must land before the site is public. No `news@` on the root (decision of 24 Aug 2026) |
| 5 | **Mailchimp audience named exactly `Dental Business News`** plus an authenticated **`news.dentalbusinessnews.com`** sending domain | ☐ | The child sets `mailchimp_audience` to exactly that string. Both halves were missed on earlier titles. Then store the mailchimp credential and let the probe pass |
| 6 | **GA4 property + Search Console** (`sc-domain:dentalbusinessnews.com`), service account granted on both | ☐ | Verify the property BY NAME through the Admin API, never from the console URL (playbook §3). If Site Kit tags, the child needs no `cogent_ga4_id`; verify with one option read |
| 7 | **LinkedIn company page** for Dental Business News | ☐ | Longest-outstanding item on every tracker. `linkedin_url` stays unset in the child until the real URL exists |
| 8 | **Name the byline person** | ☐ | The child's `cogent_author_slug` is provisionally `james-burke`. Create the byline WP user at author role BEFORE deploying the theme, with the nicename matching the slug, and change the slug in the same commit if it is someone else |
| 9 | **Private GitHub repo** for `dental-business-news-website`, remote added, pushed, anonymous curl returns 404 | ☐ | The folder is already a git repo with one commit on `main` (18 Sep 2026). No remote created, per the wave brief |

## Engine-side (Claude): runs in parallel with DNS

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 18 Sep | **53 verified feeds** in `docs/dental-business-news-sources.md` (16 NHS/government/regulator, 11 tax/business/finance/immigration, 9 trade and professional bodies, 7 press incl. 5 competitor-flagged, 4 deal advisers/accountants/lawyers, 6 plans/finance/compliance/fit-out/insurance/events) plus 39 hub-only rows. GDC, CQC's own site, NHSBSA's own site and the BDA have no working feed; their news arrives via the gov.uk atoms, NHS England and the sector press |
| B | Content plan `scripts/batch-plan-dental-business-news.json` | ✅ 18 Sep | 12 briefs, 3 waves, every one aimed at a SERP measured in brief §3, each with a SOURCE ANCHORS block pre-verified 18 Sep 2026 and STRUCTURAL REQUIREMENTS (the pattern that got Airports articles through the gate). Four are tracker seed pieces: who owns UK dentistry, UDA values, leaving the NHS, openings and closures. **Canonical section list (site must be created with exactly these):** News · Deals & Groups · NHS Contract · Private & Plans · Finance & Tax · Workforce · Regulation & Compliance · Premises & Technology |
| C | Search set | ✅ proposed 18 Sep, **needs a SHARED edit to merge** | `DENTAL_BUSINESS_NEWS_SEARCHES`, 13 queries, below. Not added to `lib/news-searches.js` or to `SEARCH_SETS` in `scripts/seed-news-searches.mjs`, per the wave's file-ownership rule |
| D | Title seed `scripts/seed-dental-business-news-title.mjs` | ✅ written, **not run** | Engine OFF, status `setup`, $5/day cap, 3/day target, `markets: ["GB"]`, newsletter/LinkedIn/outreach OFF, `authorEmail` `news@news.dentalbusinessnews.com`, the eight sections. `--dry-run` passed 18 Sep (read-only; the slug does not exist yet). Brief text in `scripts/alignment/dental-business-news.{audience.txt,editorial-standard.md,house-style.md}` |
| D2 | Sources seed `scripts/seed-dental-business-news-sources.mjs` | ✅ written, **not run** | 92 rows (53 with verified feeds). Needs the Site row first |
| E | Child theme `dental-business-news-website/child` | ✅ scaffold 18 Sep, committed locally | Surgery teal `#0B5E63` / aqua `#2BB3AA` / ink `#0B1F24`, coral in the amber slot; **teal masthead bar with a reversed white chip** (the only title whose header is not near-black); IBM Plex Sans display face (shipped as the variable TTF from the brand kit, see open questions) and JetBrains Mono. `cogent_brand` (lockup Dental [BUSINESS] / NEWS, audience, newsletter copy, contact_email, `mailchimp_audience` "Dental Business News"), `cogent_home_sections` (8), `cogent_author_slug` (provisional), 8 section patterns, nav, home template, and two directory collections (deals and groups, openings and closures) plus events. No calculators |
| F | Editorial rules | ✅ written 18 Sep, **needs a SHARED edit to merge** | Block below, ready to paste into `docs/editorial-standard.md`. Already embedded in the Site row's `editorialStandardMd` via the alignment file |
| G | Title in `TITLES` + `CHILDREN` in `cogent-base-theme/scripts/check-title-agnostic.mjs` | ☐ SHARED | Add `"dental": ["Dental Business News", "dental-business-news", "dentalbusinessnews"]` and `"dental": "../dental-business-news-website/child"`, then run `--all` |
| H | Run the seeds (title, then sources, then searches) | ☐ | After C is merged. The worktree has no `node_modules`; run from a checkout that has them |
| I | WordPress: Yoast BEFORE first publish; Engine user (editor + app password); byline user; permalinks `/%postname%/`; timezone Europe/London; Sample Page deleted | ☐ | After JB steps 2 and 8 |
| J | Deploy parent then child over SFTP; `wp option update template cogent-base`; purge; check on a phone | ☐ | New system user per site on SiteGround: keys and paths do not carry over (playbook §8) |
| K | Credentials stored + probes green (wordpress, mailchimp, google_analytics, sftp) | ☐ | |
| L | Pre-flight checklist (playbook §4) in full, then `verify-title.mjs --site=dental-business-news` 20/20 | ☐ | Also `check-all-titles.mjs`, because this deploy touches the shared parent's server |
| M | Publisher identity: `set-publisher-logo.mjs` once the palette is live; `build-brand-palettes.mjs` so newsletters take this palette | ☐ | |

## C. Proposed search set (for `lib/news-searches.js`, and `SEARCH_SETS` in `scripts/seed-news-searches.mjs`)

Tested against Google News RSS (`hl=en-GB&gl=GB`) on 18 Sep 2026. "Usable" means
a UK practice-business story an owner would act on; the incumbent's own
articles count as usable here but are not a source (the editorial standard's
seam section).

**Keep every query under 200 characters.** Measured on 18 Sep 2026: at 212
characters and above, Google News silently ignores `when:7d` and returns up to
100 stale items. The same test found live queries on other titles over that
line (SHARED changes, item 4). Every query below is 191 characters or
fewer.

```js
/**
 * Dental Business News. UK-only (markets ["GB"]), GB edition throughout.
 *
 * The brief measured the bare `dentist` feed at ~35% usable and `dental
 * practice` at ~45%, both swamped by patient health advice, obituaries, crime
 * and India's NEET admissions. So every query here is anchored on a business
 * phrase, and the patient exclusion block goes only on the queries that
 * measurably drift patient-side.
 *
 * Never seed bare `dentist`, `dental`, `teeth`, `NHS dentist`, `teeth
 * whitening`, `UDA` (it returns Kenyan politics: the UDA is a party) or a bare
 * group name.
 *
 * Finance & Tax deliberately has NO wire query: every finance query tested on
 * 18 Sep 2026 returned US DSO and stock-tip items and nothing usable from the
 * UK. It is fed by the content plan and the direct feeds only. Vendor corporate
 * news (Straumann, Dentsply Sirona, Henry Schein, Align, Envista) is likewise
 * excluded: 40 items a week, almost all stock-tip farms.
 *
 * `category` must match a section on the site, and the section list is defined
 * by scripts/batch-plan-dental-business-news.json. Keep them in lockstep.
 */
const NO_PATIENT = '-"near me" -whitening -veneers -"Turkey teeth"';

export const DENTAL_BUSINESS_NEWS_SEARCHES = [
  {
    // ~75% usable (6 of 8). Local access stories are usable only as contract
    // economics and capacity, per the owner rule.
    name: "Wire: NHS dental contract and funding",
    category: "NHS Contract",
    query: `("NHS dentistry" OR "NHS dental contract" OR "dental contract reform" OR "units of dental activity" OR "UDA value") ${NO_PATIENT} when:7d`,
  },
  {
    // 100% usable (4 of 4). Four contract regimes means four policy threads.
    name: "Wire: devolved dental contracts",
    category: "NHS Contract",
    query: `("NHS dentistry" OR "dental contract" OR "general dental services") (Wales OR Scotland OR "Northern Ireland") when:7d`,
  },
  {
    // 100% usable (2 of 2), low volume, overlaps the contract query. Feeds the
    // private conversion index.
    name: "Wire: handbacks and going private",
    category: "Private & Plans",
    query: `("dental practice" OR dentist OR dentists) ("hands back" OR "handed back" OR "going private" OR "leaving the NHS" OR "NHS contract") ${NO_PATIENT} when:7d`,
  },
  {
    // 0 in 7 days, 1 in 30 (usable). A tripwire, not a supply line: UK deals do
    // not reach Google News, which is why the deals tracker is the flagship.
    name: "Wire: UK practice and group deals",
    category: "Deals & Groups",
    query: `("dental group" OR "dental practice" OR "dental practices") (acquires OR acquired OR acquisition OR "sold to" OR "private equity") (UK OR England OR Scotland OR Wales) when:7d`,
  },
  {
    // ~65% usable (2 of 3). Group names only ever paired with a dental term.
    name: "Wire: the named dental groups",
    category: "Deals & Groups",
    query: `(mydentist OR "Bupa Dental Care" OR PortmanDentex OR "Portman Dental" OR "Rodericks Dental" OR "Clyde Munro" OR "Colosseum Dental" OR "Together Dental") (practice OR practices OR NHS) when:7d`,
  },
  {
    // ~50% usable (1 of 2 in 7 days, 2 of 3 in 14). Named local businesses:
    // the openings and closures tracker's raw material. No exclusion block:
    // it takes the query past the length limit.
    name: "Wire: practice openings and closures",
    category: "News",
    query: `("new dental practice" OR "dental practice to close" OR "dental practice closes" OR "dental practice opens" OR "dental surgery closes" OR "dental practice closure") when:7d`,
  },
  {
    // ~55% usable (5 of 9).
    name: "Wire: dental workforce",
    category: "Workforce",
    query: `("dental nurse" OR "dental nurses" OR "dental therapists" OR "dental workforce" OR "dentist shortage") (UK OR NHS OR GDC OR visa) when:7d`,
  },
  {
    // ~75% usable (3 of 4).
    name: "Wire: visas and international recruitment",
    category: "Workforce",
    query: `(dentists OR "dental nurses") ("skilled worker" OR visa OR "international dentists" OR "overseas-qualified") UK when:7d`,
  },
  {
    // ~80% usable (4 of 5). The fitness-to-practise rule governs every item:
    // published determinations only, names only as the regulator publishes
    // them, never a live case. One of the five test items was exactly that
    // trap (a named suspension with no published reason).
    name: "Wire: GDC and CQC",
    category: "Regulation & Compliance",
    query: `("General Dental Council" OR GDC OR CQC) (dental OR dentistry OR dentists) when:7d`,
  },
  {
    // ~65% usable (3 of 3 on topic, most not dental-specific). The claims rule
    // applies: the regulation and liability of aesthetics, never how-to.
    name: "Wire: aesthetics licensing and regulation",
    category: "Regulation & Compliance",
    query: `("non-surgical cosmetic" OR "cosmetic procedures" OR botox OR fillers) (licensing OR licence OR "Department of Health") (England OR UK) when:7d`,
  },
  {
    // 100% usable (4 of 4). The quotable voices on every contract story.
    name: "Wire: BDA, ADG, BDIA and BADN",
    category: "News",
    query: `("British Dental Association" OR "Association of Dental Groups" OR "British Dental Industry Association" OR "British Association of Dental Nurses") when:7d`,
  },
  {
    // ~50% usable (3 of 6).
    name: "Wire: practice software and technology",
    category: "Premises & Technology",
    query: `("dental practice" OR "dental practices" OR "dental group") (software OR AI OR "practice management" OR digital) (UK OR NHS OR Britain) when:7d`,
  },
  {
    // 100% usable (2 of 2), low volume. Award shortlists name practice owners:
    // each one is an interview target.
    name: "Wire: dental business awards",
    category: "News",
    query: `("Private Dentistry Awards" OR "Dentistry Awards" OR "Dental Awards" OR "Dental Industry Awards" OR "Aesthetic Dentistry Awards") when:7d`,
  },
];
```

Supply read: about 50 items a week gross across the thirteen, roughly 35
usable before dedupe and perhaps 20 to 25 after (the contract, bodies and
workforce queries overlap heavily). That is about 3 a day, matching the brief's
measure, and about a third of it is Dentistry.co.uk. The direct feeds, not
this set, are what keeps the title off the incumbent's copy.

Tested and rejected: bare `UDA` (Kenyan politics), finance and valuation
(0 UK items), plan providers (US and consumer noise), vendor corporate news
(stock-tip farms), dental appointments and people moves (0 UK items in 37),
practice insolvency (0 in 30 days), and every variant over 200 characters.

## F. Editorial rules (ready to paste into `docs/editorial-standard.md`)

```markdown
## Dental Business News: four rules

### The owner rule

Every article is written for someone who runs, owns, finances, buys, sells,
supplies or manages a dental practice: principals and owners, practice
managers, group operations and M&A teams, associates planning ownership, and
the brokers, accountants, lawyers, lenders and suppliers around them. We write
for principals, owners and practice managers, never patients. If the natural
reader is a patient, it is not our article: no "how to find an NHS dentist",
no treatment price guides for patients, no oral-health advice. Access-crisis
stories enter only as contract economics and capacity.

### The scope rule

The business of dentistry, never clinical practice. No technique, treatment
choice, materials recommendations or outcomes. Product launches are commercial
news (price, distribution, what it does to a practice's costs or revenue),
never a clinical recommendation.

### The claims rule

Clinical, whitening and aesthetics claims are attributed to a named source,
never asserted in our voice. Botulinum toxin and similar injectables are
prescription-only medicines: never describe or encourage their promotion to
the public, and never imply a non-prescriber may supply them. Tooth whitening
above 0.1% hydrogen peroxide may be supplied only by or under registered dental
professionals: cover the law, the enforcement and the lawful business, never
how to whiten. State the status of England's non-surgical cosmetics licensing
scheme as of the source's date, attributed. Cover the revenue, regulation and
liability of aesthetics, never how-to or before-and-after.

### The fitness-to-practise rule

GDC and CQC enforcement stories carry libel risk because the accused are our
readers. Report only published determinations and concluded outcomes, from the
regulator's or court's own record. Name only what the regulator names, in the
form it names it; if a determination anonymises a registrant, so do we. No live
cases: nothing from a complaint, investigation, interim order, referral or
unconcluded hearing, and nothing from a report that precedes a determination.
Policy, statistics and aggregate outcomes are always fine. When in doubt the
piece runs without the name, or does not run.

The fleet's figures rule applies: LaingBuisson's £12.16bn (2023/24) is the
high-street market, not the NHS budget or practice income; name source and year
on every figure and never blend them.
```

## Post-launch build queue (the seam, brief §8)

1. **UK Dental Deals and Groups Tracker.** Declared as the `dental-deals`
   directory collection in the child. Seeded from wave 1's "Who owns UK
   dentistry" piece, then fed by Dental Group Signal, broker "sold" pages,
   Companies House and CMA merger notices. Create its page only once the seed
   article is live.
2. **Practice Openings and Closures Tracker.** Declared as
   `practice-openings-closures`. Seeded from wave 3; the real feed is CQC's
   registration and deregistration data, a scheduled pull that does not exist
   yet (a build, and a shared one if it goes in the engine).
3. **NHS Contract Value Explorer.** Contract values and UDA rates by practice
   and ICB from NHSBSA open data, with handbacks as they happen. Needs data
   loading and refresh; does not fit the directory type's "every row from a
   published article" rule as it stands.
4. **Private Conversion Index.** NHSBSA contract data year on year by area,
   plus local press. Same build as 3.
5. **Benchmarks page.** NASDAL, Christie & Co and LaingBuisson figures in one
   attributed table, refreshed on each release.

## Open questions and decisions for JB

- **The gate.** The brief scored this 55/100 and said to proceed only with one
  named owner-buying advertiser. Which of the five wave owners takes this
  title, and who is the advertiser?
- **The byline person.** Provisional `james-burke` in the child until named.
- **The display face.** IBM Plex Sans is shipped as the brand kit's variable
  TTF (537 KB) because no woff2 encoder is installed on this machine and
  downloading font files was out of scope. Convert to woff2 at the design pass.
  The kit's `page.mjs` uses Plex for its own review page, but no live title's
  masthead or site uses it. **Check the four sibling wave titles did not pick
  Plex too**: it is the only unused variable sans in the kit's fonts folder.
- **Masthead art.** The typeset lockup stands in. A drawn mark goes through the
  brand kit (`cogent-base-theme/scripts/brand`), own face and structure, not a
  recolour.
- **Down-weighting Dentistry.co.uk** (brief §12.6). The engine has no special
  handling for "Sector press (competitor)" sources, so the incumbent's feed is
  scanned and rewritten like any other. Either a shared engine change (skip or
  demote competitor-category sources as rewrite candidates) or leave the row
  out of the seed. JB's call; the seed currently includes it for monitoring.
- **`lib/reachability.js`** has no dental coverage. Add the obvious
  non-responders (the big groups, Bupa, the manufacturers) before outreach is
  ever switched on. Outreach stays off until ~20 published articles.
- **Keyword collisions**: none. A read-only query on 18 Sep 2026 found no
  `KeywordTarget` term and no article title containing "dental" or "dentist"
  on any live title.
- **Ireland** was not included in `markets`. Add `"IE"` in the Site row if it
  ever earns a place.

## SHARED changes this title needs (none made; all described here)

1. **`lib/news-searches.js`**: add `DENTAL_BUSINESS_NEWS_SEARCHES` (block C)
   and register it for `dental-business-news` in `SEARCH_SETS` in
   `scripts/seed-news-searches.mjs`.
2. **`docs/editorial-standard.md`**: paste block F.
3. **`cogent-base-theme/scripts/check-title-agnostic.mjs`**: add the title to
   `TITLES` and `CHILDREN` (row G above).
4. **Fleet-wide finding: long Google News queries lose their date filter.**
   Measured 18 Sep 2026 by fetching all 46 live queries of the three most
   recent sets: every one of 212 characters or more (16 of them: 8 of 19 in one
   set, 5 of 15 in another, 3 of 12 in the third) came back with `when:7d`
   ignored and 50 to 100 items, nearly all older than nine days. Every query of
   200 characters or fewer honoured the filter. Two more live queries are over
   200 in the older sets (236 and 202 characters) and were not fetched. Run the
   same length check across `lib/news-searches.js` to get the list. Dedupe probably hides most of the damage, but these queries are
   feeding the Researcher stale items and missing fresh ones past the 100-item
   cap. Worth a length guard in `lib/news-searches.js` (warn or throw over 200)
   and a trim of the 18, in a session that owns the shared file.
5. **The worktree has no `node_modules`**, so none of the seed scripts run
   there as-is. The title seed's `--dry-run` was run by pointing
   `@prisma/client` at the main checkout's install through a scratch loader
   hook, read-only.
