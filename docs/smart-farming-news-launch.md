# Smart Farming News: launch tracking

One of the five titles in the 18 Sep 2026 wave. Domain **smartfarmingnews.com**
(bought 18 Sep 2026 at GoDaddy, .com only, no .co.uk). Slug
**`smart-farming-news`**. Session prefix: 🚜 FARM. Project folder:
`smart-farming-news-website`. Vertical case: `docs/vertical-brief-farming.md`
(scored 66/100). Process: `docs/new-title-playbook.md`; this file tracks this
title's run through it.

Markets `["GB"]`: UK-led, Ireland only where it moves UK farm money.

---

## The angle, and the decision JB still owes

The brief chose **the farm as a land business** as the seam, because Farmers
Weekly (Tranco ~50k) owns general farm news. The name JB bought pulls the other
way: "smart farming" normally means agtech, which is Future Farming's ground
(futurefarming.com, live and global), with Farmers Guide and Tech Farmer
Magazine also covering farm tech.

The build defaults to a **combined angle, "farming smarter as a business"**:
technology judged by its payback, plus the land-business money the brief found
unowned. Every piece answers what it costs, what it returns and who has done it.

**Canonical section list (the Site row must be created with exactly these):**

| Section | Slug | Half |
|---|---|---|
| News | `news` | both |
| Energy & Land Use | `energy-land-use` | land-business |
| Farm Tech | `farm-tech` | **tech** |
| Diversification | `diversification` | land-business |
| Software & Data | `software-data` | **tech** |
| Natural Capital | `natural-capital` | land-business |
| Finance & Grants | `finance-grants` | both |
| Land, Tax & Succession | `land-tax-succession` | land-business |

**Leaning it later needs no rebuild.** Leaning tech: raise Farm Tech and
Software & Data targets in the Site row, reorder `cogent_home_sections` and
`home.html` to put them second and third, and add tech queries to the search
set. Leaning land: the reverse. No section is deleted either way, so no
published article loses its homepage slot. The one thing a hard lean toward
agtech would change is the competitive read: it walks into Future Farming's
ground, which the brief did not measure.

Current balance: the content plan is 8 land-business briefs to 4 tech or
finance (the brief's verified SERP gaps are nearly all land-side); the search
set is 7 land-business, 4 tech, 2 finance and 1 news; the
verified feeds skew land-side (see the sources doc).

---

## JB's critical path (starts the clock: nothing downstream moves without #2)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **The angle decision** (above) | ☐ | Default is combined. Needed before the first public article, not before the build |
| 2 | **Create site at SiteGround** (domain smartfarmingnews.com), THEN point GoDaddy nameservers to `ns1/ns2.siteground.net` | ☐ | That order, never the reverse. Same server as the other titles if possible (c1116205.sgvps.net). Then HTTPS Enforce on, not just the certificate |
| 3 | **Google Workspace: add smartfarmingnews.com as a SECONDARY domain** to the existing org; user `jb@smartfarmingnews.com`; DKIM | ☐ | No `news@` user on the root (24 Aug decision); news goes via `news@news.smartfarmingnews.com`. Edit SiteGround's SPF in place to add `include:_spf.google.com`, never a second `v=spf1`. The child's `contact_email` is already `jb@smartfarmingnews.com` and bounces until this is done |
| 4 | **Mailchimp audience** named exactly `Smart Farming News`, plus **`news.smartfarmingnews.com` authenticated as a sending domain** | ☐ | The child sets `mailchimp_audience` to that exact string. Both halves were missed on earlier titles |
| 5 | **GA4 property + Search Console** (`sc-domain:smartfarmingnews.com`), service account granted both | ☐ | Then either Site Kit tags, or add `cogent_ga4_id` in the child (commented stub is there). Not both |
| 6 | **LinkedIn company page** | ☐ | `linkedin_url` stays unset until the real URL exists. Longest-open item on every tracker |
| 7 | **Name the byline person** | ☐ | Each live title bylines its own person. The child currently returns `james-burke` (real, and the parent's fallback) so nothing resolves to the admin; `Site.authorName` is null. Change both together |
| 8 | **Name one reachable advertiser** (the Dec/Tom gate; the title's owner among the five) | ☐ | Brief §7: the Farm Business Innovation Show's 250+ exhibitor list is the seam's advertiser list; Hotel/Bar Magazine for farm venues and lets is the only CIM crossover |

## Engine-side (Claude): runs in parallel with DNS

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 18 Sep | **49 verified feeds** in `docs/smart-farming-news-sources.md` (19 government/regulator/Parliament, 9 levy/trade/research bodies, 8 energy/planning/land-use press, 3 agtech/investment, 6 competitor-flagged sector press, 2 national press desks, 2 supplier/adviser) + 54 hub-only rows. Farmers Weekly, Farmers Guardian, FarmingUK, NFU and CLA have no feeds |
| B | Content plan `scripts/batch-plan-smart-farming-news.json` | ✅ 18 Sep | 12 briefs, 3 waves, each aimed at a SERP gap the brief measured or that was checked 18 Sep; SOURCE ANCHORS blocks carry only figures verified that day, and everything else is marked as an attributed claim. Categories match the section list exactly |
| C | Search set `SMART_FARMING_NEWS_SEARCHES` | ✅ proposed, **not merged** | 14 queries, all tested against Google News RSS (GB edition) 18 Sep. Block below. Needs the shared edit in "Shared changes" |
| D | Title seed `scripts/seed-smart-farming-news-title.mjs` | ✅ written, **not run** | Engine OFF, status setup, $5/day cap, 3/day target, markets GB, newsletter/LinkedIn/outreach OFF, `authorEmail` news@news.smartfarmingnews.com, 8 sections. `--dry-run` passes (it never touches the database). Brief text in `scripts/alignment/smart-farming-news.{audience.txt,editorial-standard.md,house-style.md}` |
| D2 | Sources seed `scripts/seed-smart-farming-news-sources.mjs` | ✅ written, **not run** | 103 rows (49 verified feeds). Run after D |
| E | Child theme `smart-farming-news-website/child` | ✅ scaffold 18 Sep, committed locally | Field Orange / Graphite palette, Barlow Condensed display face, 8 section patterns, nav, home template, `cogent_brand` (with `mailchimp_audience` "Smart Farming News"), `cogent_home_sections`, `cogent_author_slug`. `git init -b main` + first commit; **no remote yet** (private GitHub repo is a JB step). Typeset lockup until the drawn mark is built |
| F | Editorial rules | ✅ drafted, **not merged** | Block below, ready to paste into `docs/editorial-standard.md`. Also embedded in the Site row via the alignment file |
| G | Keyword collisions | ✅ checked 18 Sep | Read-only across all titles; see below |
| H | Site row + sources + searches seeded | ☐ | After JB's go: D, then D2, then `seed-news-searches.mjs` once C is merged |
| I | WordPress: Yoast BEFORE first publish; Engine user (editor + app password); byline user at author with the nicename right | ☐ | After step 2 |
| J | Credentials stored + probes green (wordpress, mailchimp, google_analytics, sftp) | ☐ | Encrypted in the DB, not env vars |
| K | Theme deploy (parent then child) over SFTP, activate, `wp option update template cogent-base`, purge | ☐ | `node scripts/deploy-theme.mjs --site=smart-farming-news --from=../smart-farming-news-website/child` |
| L | Pre-flight (playbook §4) and `verify-title.mjs --site=smart-farming-news` all PASS | ☐ | Then engine on, wave 1 |
| M | Tools pages | ✅ none at launch | Candidates for later: land-use income index, APR/IHT illustration (no-advice framing), machinery payback |

---

## C. Proposed search set (for `lib/news-searches.js`)

Tested 18 Sep 2026 against Google News RSS, GB edition. "Items" is what the
exact query below returned; "usable" is the share of a sampled 20 to 30 items
that were UK business-intent stories this title would write from, judged by
hand.

**Caveat found in testing:** Google does not honour `when:7d` for every query
shape. The solar, grants, BNG and land-value queries returned items up to twelve
months old, so their counts overstate weekly supply. The scan dedupes by link,
so the first scan backfills and later scans see only new items, but do not read
these counts as items per week.

| # | Query | Section | Items | Usable |
|---|---|---|---|---|
| 1 | farm diversification projects | Diversification | 17 | ~50% (local planning decisions; some dog-field and kennel noise) |
| 2 | lets, venues and farm buildings | Diversification | 80 | ~55% (planning plus FW/Farmers Guide features; some consumer glamping) |
| 3 | solar on farmland | Energy & Land Use | 76 | ~60% (window leaks: items span ~12 months; objection-heavy, politics rule) |
| 4 | landowner energy deals | Energy & Land Use | 77 | ~55% (BESS, AD, biomethane, wind; Scottish wind noise) |
| 5 | BNG, carbon and nature markets | Natural Capital | 79 | ~60% (gov.uk blogs, land deals; some Australian carbon noise) |
| 6 | APR, IHT and succession | Land, Tax & Succession | 56 | ~60% (advisers, HMRC, Commons Library). The bare IHT query was ~40%, mostly politics |
| 7 | farmland values and rents | Land, Tax & Succession | 54 | ~70% (includes Savills archive pages) |
| 8 | agritech and precision farming | Farm Tech | 98 | ~55% (funding calls, trials; some global listicles) |
| 9 | robots, autonomy and machinery data | Farm Tech | 54 | ~70% (AEA registrations, robots, drones) |
| 10 | agtech funding and deals | Farm Tech | 77 | ~50% (UK raises; tracker-list and global noise) |
| 11 | farm data, software and AI | Software & Data | 100 (cap) | ~50% (UK AI and data stories; US John Deere noise) |
| 12 | equipment, technology and capital grants | Finance & Grants | 100 (cap) | ~85% (window leaks; FETF, Capital Grants, ADOPT) |
| 13 | farm lending and finance | Finance & Grants | 78 | ~70% (banks' farm lending, Oxbury, BBB) |
| 14 | industry appointments | News | 75 | ~60% (Movers column; some incumbents' own news) |

Rejected in testing: a bare battery-storage-on-farmland query (9 items, ~10%);
an agtech-deals query without a UK scope (13 items, ~15% UK); a machinery-data
query that matched "variable rate" mortgages (11 items, 0%); a Farm Business
Survey data query (8 items, too thin); and the general SFI/Countryside
Stewardship grants query, which was ~80% usable but is the incumbents' daily
beat, so the grants query is scoped to capital and technology funds only.

Register it as `"smart-farming-news": SMART_FARMING_NEWS_SEARCHES` in
`SEARCH_SETS` in `scripts/seed-news-searches.mjs`, and import it there. No
locale key is needed: every query is GB.

```js
// Consumer and hobby stems that the owner rule keeps out of the wire:
// Clarkson's Farm, farm-shop reviews, days out, property listings, petting farms.
const NO_FARM_NOISE =
  '-Clarkson -"Diddly Squat" -"farm shop" -"days out" -pumpkin -"for sale" -"near me" -"open farm" -petting';

// Paid market-research listings ("Precision Agriculture Market Size 2034") swamp
// every agtech query and carry no reportable fact.
const NO_MARKET_REPORT = '-"market size" -"market report" -CAGR';

export const SMART_FARMING_NEWS_SEARCHES = [
  {
    name: "Wire: farm diversification projects",
    category: "Diversification",
    query: `UK ("farm diversification" OR "diversified farm" OR "diversification project" OR "diversification scheme") ${NO_FARM_NOISE} when:7d`,
  },
  {
    // Planning decisions are the kernel here: every approval or refusal is a
    // named farm, a named use and usually a stated income case.
    name: "Wire: lets, venues and farm buildings",
    category: "Diversification",
    query: `UK (farm OR farmer OR farmland OR "farm buildings") ("holiday let" OR "holiday lets" OR glamping OR "shepherd huts" OR "wedding venue" OR "barn conversion" OR "Class Q" OR "self-storage" OR "business units") (planning OR approved OR refused OR income OR tax OR business) ${NO_FARM_NOISE} when:7d`,
  },
  {
    // The politics rule applies to everything this returns: objection
    // campaigns and "food versus solar" rows are reported as business (who is
    // paid, how much, what was decided), never taken sides on.
    name: "Wire: solar on farmland",
    category: "Energy & Land Use",
    query: `UK (farmland OR "agricultural land" OR landowner OR landowners OR farmer) ("solar farm" OR "solar park") (approved OR approval OR planning OR consent OR refused OR lease OR rent OR income) ${NO_FARM_NOISE} when:7d`,
  },
  {
    name: "Wire: landowner energy deals",
    category: "Energy & Land Use",
    query: `UK (landowner OR landowners OR farmer OR farmers OR farmland) ("battery storage" OR "grid connection" OR "wind farm" OR "anaerobic digestion" OR biomethane OR "option agreement" OR "community benefit") -offshore when:7d`,
  },
  {
    name: "Wire: BNG, carbon and nature markets",
    category: "Natural Capital",
    query: `UK ("biodiversity net gain" OR "habitat bank" OR "nature market" OR "nature markets" OR "natural capital" OR "carbon credits" OR "woodland carbon") (farm OR farmers OR landowners OR "land managers" OR farmland) when:7d`,
  },
  {
    // The no-advice rule and the politics rule both apply. Scoped to the
    // rules, the advisers and HMRC so the protest-and-personality coverage of
    // the farm tax stays out; the bare "farm inheritance tax" query is ~40%
    // politics.
    name: "Wire: APR, IHT and succession",
    category: "Land, Tax & Succession",
    query: `("agricultural property relief" OR "business property relief" OR "farm inheritance tax" OR "farm succession" OR "succession planning") (farm OR farmers OR farming OR estate) (HMRC OR adviser OR advisers OR accountants OR solicitors OR allowance OR "£2.5m" OR planning) when:7d`,
  },
  {
    name: "Wire: farmland values and rents",
    category: "Land, Tax & Succession",
    query: `("farmland values" OR "farmland prices" OR "farmland market" OR "farm rents" OR "farm business tenancy" OR "agricultural tenancy" OR "land values") (UK OR England OR Scotland OR Wales OR Savills OR "Knight Frank" OR "Strutt & Parker" OR "Carter Jonas") when:7d`,
  },
  {
    name: "Wire: agritech and precision farming",
    category: "Farm Tech",
    query: `UK (agritech OR "agri-tech" OR "precision farming" OR "precision agriculture" OR "farm robot" OR "agricultural robotics") (farm OR farmers OR growers) ${NO_MARKET_REPORT} ${NO_FARM_NOISE} when:7d`,
  },
  {
    // Tractor registrations are the AEA's monthly data drop and the cleanest
    // capex signal the sector publishes; robots and drones are the payback
    // stories the title exists to judge.
    name: "Wire: robots, autonomy and machinery data",
    category: "Farm Tech",
    query: `("tractor registrations" OR "autonomous tractor" OR "robotic milking" OR "milking robot" OR "precision spraying" OR "farm robot" OR "agricultural robot" OR "spray drone" OR "agricultural drone") (UK OR British OR farmers) ${NO_MARKET_REPORT} when:7d`,
  },
  {
    name: "Wire: agtech funding and deals",
    category: "Farm Tech",
    query: `(agritech OR "agri-tech" OR agtech) (raises OR raised OR funding OR "seed round" OR "Series A" OR acquires OR acquisition) (UK OR British OR London OR Cambridge OR Scotland) ${NO_MARKET_REPORT} when:7d`,
  },
  {
    name: "Wire: farm data, software and AI",
    category: "Software & Data",
    query: `("farm data" OR "farm management software" OR "herd management" OR "farm software" OR "digital farming" OR AI) (farmers OR farm OR farming) (UK OR British OR AHDB OR Defra OR England) ${NO_MARKET_REPORT} -"data centre" when:7d`,
  },
  {
    // Deliberately NOT the general SFI or Countryside Stewardship beat, which
    // is the incumbents' daily ground. Only the capital and technology grants
    // that change a payback sum.
    name: "Wire: equipment, technology and capital grants",
    category: "Finance & Grants",
    query: `("Farming Equipment and Technology Fund" OR FETF OR "Farming Innovation Programme" OR "Farming Investment Fund" OR "Capital Grants" OR "ADOPT Fund" OR "Rural England Prosperity Fund") (farm OR farmers OR farming OR growers) when:7d`,
  },
  {
    name: "Wire: farm lending and finance",
    category: "Finance & Grants",
    query: `UK (farm OR farmers OR farming OR agricultural OR agriculture) (lending OR loan OR loans OR "asset finance" OR "green finance" OR mortgage) (bank OR Oxbury OR AMC OR Lloyds OR NatWest OR HSBC OR Barclays OR Santander) when:7d`,
  },
  {
    // The Movers column: named people at named firms, and both sides reshare it.
    name: "Wire: industry appointments",
    category: "News",
    query: `UK (agritech OR "agri-tech" OR "rural business" OR "land agent" OR "natural capital" OR "farm business" OR agricultural OR farming) (appoints OR appointed OR "joins as" OR "named as" OR "new chief executive") (director OR head OR partner OR "chief executive" OR chair) when:7d`,
  },
];
```

---

## F. Editorial rules, ready to paste into `docs/editorial-standard.md`

Same shape as the other per-title sections. The full working standard, which
the Site row reads, is `scripts/alignment/smart-farming-news.editorial-standard.md`.

```markdown
### Smart Farming News: four rules

**1. The money-question rule.** Every piece answers three questions for a farm
or land business: what does it cost, what does it return, and who has done it.
A robot, a software package, a solar lease, a habitat bank and a holiday let are
all capital decisions, and the article is not finished until the reader can see
the payback, or the reason it cannot yet be known. If a piece cannot name a
cost, a return or a real farm or business that has done it, it is a press
release and does not run. The reader owns, runs, finances or advises a farm or
rural land business: never a shopper, a tourist, a Clarkson viewer or a
smallholding dreamer. No farm-shop reviews, no days out, no property listings.

**2. The no-advice rule.** APR and BPR, inheritance tax, succession, tenancy
terms and energy or BNG lease terms are high-value money decisions, often on
estates worth millions. We report the rules, the numbers, the deadlines and
named advisers' views, and we never tell a reader what to do with their estate,
their tenancy or their land. No "you should" on a tax or succession point. Every
tax piece names the rule's source (HMRC, the Finance Act, the Commons Library)
and its date, says to take professional advice, and is re-reviewed when the
rules change. The farm inheritance tax change is politically charged: we take
no line on the government, the campaigns, the protests or the reversal
pressure. We report who pays, how much, from when, and what advisers say.

**3. The claims rule.** Vendors, energy developers, carbon and BNG brokers and
lead-gen sites all publish yields, savings, rents and paybacks. Every such
figure is attributed to whoever claimed it, dated, and never asserted in our
own voice: "up to 30% less spray" is the vendor's sentence, not ours. Where
independent data exists (AHDB, Defra, a university trial, a land agent's
survey), set it beside the claim. Lease rents, BNG unit prices and carbon prices
are always attributed ranges, because the sources define them differently.

**4. The stay-off-the-daily-beat rule.** Commodity prices, general SFI and
Countryside Stewardship news, livestock disease, machinery launches for their
own sake and contractor charges are the incumbents' daily ground (Farmers
Weekly, Farmers Guardian, FarmingUK), and they will always have it first. We
cover them only when the story changes a payback sum or a land-use decision,
and the headline says which. The engine is never seeded with the bare queries
"farmers", "farm shop", "farm for sale" or "farm subsidies".

Two standing sub-rules from the brief carry over. Solar-on-farmland fights and
planning objections are reported as business (who is paid, how much, what was
decided), never as a side taken. Farm deaths and rural crime are not covered as
news; farmer mental health only as a business-support topic with named
charities. Vehicle tax and double-cab pickups belong to The Fleet Magazine, and
generic small-business queries (starting a farm shop, business rates for any
business) to Smart SME.
```

---

## Keyword collisions (read-only check, 18 Sep 2026)

Queried the whole `KeywordTarget` table through a fleet-wide read (the
equivalent of `fleetRead()`, not `forSite()`), 384 rows across five titles, and
scanned it for farm, rural, land, solar, battery, BNG, carbon, diversification,
lets, IHT, succession, tractor, pickup, business rates, lease, finance, drone
and robot stems. Then scanned all 588 `Article` titles the same way.

**Registry: no collision.** No title has claimed any of the twelve plan terms or
any farm, land-use or rural term. Nearest adjacent claims, none of which the
plan targets:

| Title | Claimed term | Why it is adjacent, and the line |
|---|---|---|
| The Fleet Magazine | `company car tax`, `tax rules on company cars`, `salary sacrifice van scheme uk` | Pickup and BIK territory. The machinery-finance brief is told never to target pickups or BIK |
| The Fleet Magazine | `guidance: zero emission van and truck grant` | Grant language; our grants query is scoped to farm funds only |
| The Fleet Magazine | `leased vans will now qualify for capital allowance` (candidate) | Capital allowances on leases; the machinery-finance brief states the rule for farm kit only |
| Smart SME | `best property management software for small landlords uk` | Near "letting farm buildings"; different intent (residential landlords) |
| Smart SME | `scottishpower helps small businesses access lower energy prices` | Business energy, not land leases |

**Published articles: two live overlaps, both on the other titles' side of the
line.**

- The Fleet Magazine: *Double Cab Pickup Tax Rules: What Changed and What It
  Costs* and *Toyota Hilux Two-Seat Conversion: What It Means for Business
  Pickup Fleets*. Fleet owns these; Smart Farming News must not write a pickup
  tax piece.
- Smart SME: two business-rates pieces (*Business Rates Reform...*, *British
  Beauty Industry Calls for Burnham to Act on Business Rates...*) and *EDF and
  Heliotec Launch Solar Partnership to Cut Small Business Energy Bills*. The
  letting-buildings brief covers business rates on let farm units only; the
  solar brief is land leases, not rooftop energy bills. No conflict, but a
  generic "business rates" or "solar for business" target would be.

**Unclaimed but at risk:** "farm diversification ideas UK" and "how to start a
farm shop business UK" are Smart SME-shaped (brief §9). Neither is in Smart
SME's registry today. The diversification position piece targets the first; it
should be claimed for this title in `KeywordTarget` when the Site row exists,
so Smart SME's Researcher sees it as taken. The farm-shop query is left alone.

---

## Shared changes needed (NOT made: every one touches a shared file)

| # | File | Change |
|---|---|---|
| S1 | `lib/news-searches.js` | Add the C block (two exclusion constants plus `SMART_FARMING_NEWS_SEARCHES`) |
| S2 | `scripts/seed-news-searches.mjs` | Import it and add `"smart-farming-news": SMART_FARMING_NEWS_SEARCHES` to `SEARCH_SETS` |
| S3 | `docs/editorial-standard.md` | Paste the F block |
| S4 | `cogent-base-theme/scripts/check-title-agnostic.mjs` | Add Smart Farming News to `TITLES` and the child to `CHILDREN`, then run `--all` |
| S5 | `lib/brand/palettes.js` | Rerun `scripts/build-brand-palettes.mjs` so newsletters and outreach take Field Orange and Barlow Condensed, not a fallback |
| S6 | `lib/brand/wordmarks.js` | Needs an entry once the drawn mark exists. Without one, the newsletter falls back to another title's logo (the barbering/airport bug of Sep 2026) |
| S7 | `lib/briefing-template.js` | Add a `smart-farming-news` entry (name, emoji, font "Barlow Condensed", colours from theme.json, `uk: true`) |
| S8 | `lib/inbox-labels.js` | Add `"smart-farming-news": "Titles/Farming"` for the Gmail hub |
| S9 | `scripts/utility-pages-content.mjs`, `scripts/set-publisher-logo.mjs` | Add the title's about/advertise copy and its site folder, before running the utility-pages and publisher-logo steps |
| S10 | `lib/reachability.js` | Add the farm sector's obvious non-responders before outreach is ever switched on (it is a UK SME tech/banking denylist today) |
| S11 | `KeywordTarget` (DB write) | Claim the 12 plan terms for this title once the Site row exists, starting with "farm diversification ideas uk" |

Before S1 to S10 land, check what the four sibling wave titles are adding to
the same files: five agents touching `SEARCH_SETS`, `briefing-template.js` and
`inbox-labels.js` in one day will conflict.

---

## Design notes

- **Palette:** Field Orange `#C2410C` (brand; white text clears 5.2:1), Field
  Orange Bright `#F26B1D`, Graphite `#12151A` (contrast), Surface `#F4F5F2`,
  Crop Lime `#4D7C0F` (green slot), Sensor Teal `#0F766E` (cyan slot), Grain
  Amber `#A16207`. Machinery orange on instrument graphite: technical, not
  rustic, and no live title uses orange as its brand (Smart SME indigo, Fleet
  motorway blue, Golf green, Barbering oxblood, Airport navy and sky). **Check
  the four sibling wave titles before locking it**: one of them may also have
  reached for orange.
- **Faces:** Barlow Condensed (headings and lockup; static 600 and 800 TTFs
  from the brand kit, SIL OFL, licence in `assets/fonts/licences/`), system
  sans body, JetBrains Mono. Barlow comes from road signage and machinery
  livery, which is the technical, not rustic, register wanted. No live title
  uses it. **IBM Plex Sans was the first pick and was dropped on 18 Sep because
  the Dental Business News child (same wave) had already chosen it.** Convert
  both TTFs to woff2 at the design pass.
- **Masthead:** the parent's typeset lockup for now ("Smart Farming NEWS" with
  the orange chip, kicker "FARMING SMARTER AS A BUSINESS"). The drawn mark and
  tab icon come from `cogent-base-theme/scripts/brand`, per the masthead
  system: own face and structure, never a recolour of a sibling.

---

## Open questions and watch list

- **The angle** (JB step 1). Everything is built so it can lean either way.
- **Brand adjacency.** "Smart" is also the first word
  of Smart SME. Nothing of Smart SME's has been reused here (checked by grep),
  but readers and Google may pair the two brands. Worth a conscious yes.
- **Future Farming** (futurefarming.com) is the live incumbent for "smart
  farming" as a phrase. If JB leans tech, measure its Tranco rank and SERP
  presence first; the brief did not.
- **Byline person** (JB step 7).
- **Farm Business Innovation Show** (NEC, November): the seam's advertiser list
  and the first sales target. It falls within weeks of launch.
- **Brief figures still unverified** and therefore only ever used as attributed
  claims in the plan: solar and BESS rents (lead-gen and law-firm ranges), BNG
  unit prices and market size (vendor figures), Savills' £8,873/acre, bank
  lending £18.8bn (via FW), the 48% no-succession-plan figure, robotic milking
  costs and adoption (via FW).
- **Defra diversification figures:** the government release gives £31,100 as
  the mean diversified enterprise income for farms that diversify; the brief's
  £22,400 and "31% of farm income" come from Farmers Weekly's reporting of the
  same release. The plan anchors on the gov.uk figures and tells the drafter not
  to mix the two.
- `smartfarmingnews.co.uk` is unregistered. Anyone can take it; about £10 to
  close off while it is free.
- Newsletter, LinkedIn and outreach all seeded OFF. Outreach waits for ~20
  published articles (playbook §12).
