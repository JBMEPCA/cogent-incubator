# Nursery Daily: launch tracking

One of the five titles in the 18 Sep 2026 wave. JB chose the name **Nursery
Daily** and bought **nurserydaily.com** at GoDaddy on 18 Sep 2026 (.com only,
no .co.uk). Vertical case: `docs/vertical-brief-nurseries.md` (scored 56/100
after calibration). Process: `docs/new-title-playbook.md`; this file tracks
this title's run through it.

Slug: **`nursery-daily`**. Session prefix: 🧸 NURSERY. Project folder:
`nursery-daily-website`. Markets: `["GB"]`, England-led, with Scotland, Wales
and Northern Ireland named whenever their rules differ.

**Seam:** the nursery as a business, for whoever signs the lease and the
payroll. Funding-rate economics, fees and occupancy, deals and valuations,
property, staffing cost and compliance cost. Teaching and child development
stay with Nursery World.

---

## STOP: the engine cannot hold this title's articles for a human

The brief (§9 rule 2, §12 item 2) says: any draft touching a child's death,
abuse or a criminal case goes to a human before publish, this title has no
auto-publish path, and **if the engine cannot guarantee that, do not launch**.

**It cannot, as of 18 Sep 2026.** Read-only look at `lib/`, `app/api/` and
`prisma/schema.prisma` on `five-titles-wave` (= origin/main):

- The `Site` model has no approval, review or hold field. `EngineSetting`
  (per-site key/value) exists, but nothing on the publish path reads a key
  like it.
- `ArticleStatus` does have `review` and `approved`, but they are not a gate.
  `app/api/cron/publish-due/route.js` selects articles in status
  `["review", "approved"]` with `qaPassed: true` and a due `scheduledFor`, and
  posts them to WordPress with `status: "publish"`. A QA pass is enough; no
  human ever has to move an article to `approved`.
- `scripts/batch-publish.js` posts straight to WordPress with
  `status: "publish"` too (line ~792).
- The QA gate (`lib/qa.js`) is a model reading the title's
  `editorialStandardMd`. That is a prompt, and playbook §8 "A prompt is not a
  guard" already records why that is not enough.
- Images come from Openverse and Wikimedia Commons via `lib/images.js`, not
  from an image generator, so "no AI-generated children" holds by
  construction. "No stock photos of identifiable children" is enforced by
  nothing except the picture gate's prompt.

So there is nothing to set in the seed. `scripts/seed-nursery-daily-title.mjs`
seeds the engine OFF and says so in its header.

### The shared change that would unblock it (not made; needs JB)

Smallest version that meets the brief, per THE RULE (off by default, so no
other title changes behaviour):

1. **Schema:** `Site.requireHumanApproval Boolean @default(false)`. A column
   rather than an `EngineSetting` key, because `verify-title.mjs` and the
   dashboard should be able to show it.
2. **`publish-due`:** when the flag is on, select `status: "approved"` only
   (not `review`). The existing `advanceArticle` action in `lib/actions.js`
   already moves `review` to `approved`, so the human step is one click on
   /content that exists today.
3. **`batch-publish.js`:** when the flag is on, post to WordPress as
   `draft` and leave the Article in `review`, or refuse to run.
4. **Any other publish path** found by grepping for `status: "publish"` and
   `"published"` in `lib/` and `app/` must honour the flag too.
5. **`verify-title.mjs`:** a check that fails a title whose flag is on and
   which has anything able to publish without `approved`.
6. Optional but worth it for this title: a per-title sensitive-term list
   (child's name patterns are impossible, but "died", "death", "abuse",
   "court", "charged", "sentenced", "choking", "injury", "safeguarding
   notice") that forces a hold with a stated reason even when the flag is off,
   so the rule survives if the flag is ever turned off to clear a backlog.
7. Picture gate: a per-title instruction (read from the Site row, not
   hardcoded) that refuses any image with an identifiable child.

With (1) to (3) in place, add `requireHumanApproval: true` to the seed's DATA
block and nothing else in this title's files changes.

The cost JB should weigh: with every article waiting for a click, three a day
means a human touching the dashboard every day, and on days nobody does, the
title publishes nothing. That is the brief's intent, but it is a staffing
decision as much as a code one.

---

## JB's critical path (starts the clock; nothing downstream moves without #2)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | **Register domain** | ✅ 18 Sep | nurserydaily.com at GoDaddy. No .co.uk (JB, 18 Sep). No trademark check was done in this prep and none should be done from this machine |
| 2 | **Create site at SiteGround** (nurserydaily.com), then at GoDaddy point nameservers to `ns1/ns2.siteground.net` | ☐ | That order, never the reverse. Then HTTPS Enforce on once the certificate issues |
| 3 | **Google Workspace: add nurserydaily.com as a SECONDARY domain** to the existing org; licensed user `jb@nurserydaily.com` (the child theme's contact_email); generate DKIM | ☐ | No `news@` user on the root (24 Aug decision). Edit SiteGround's existing SPF record in place to add `include:_spf.google.com`; never a second `v=spf1` |
| 4 | **Mailchimp audience** named exactly `Nursery Daily`, plus the **`news.nurserydaily.com` sending domain** authenticated | ☐ | The child sets `mailchimp_audience` to exactly that string. Seed authorEmail is `news@news.nurserydaily.com` |
| 5 | **GA4 property + Search Console** (`sc-domain:nurserydaily.com`), service account granted on both | ☐ | Site Kit tags as `GT-`, so verify by view-source, not a `G-` grep |
| 6 | **LinkedIn company page** | ☐ | `linkedin_url` stays unset in the child until the real URL exists. Never guess the handle |
| 7 | **Name the byline person** | ☐ | Brief: named human editors are a launch requirement for this title. Child uses `james-burke` as a resolving placeholder; Site row `authorName` is null |
| 8 | **Decide the human-review gate** (the section above) | ☐ **BLOCKER** | Engine stays off until this exists |
| 9 | **One named advertiser test** (brief §12) | ☐ | Famly, Christie and Co, Morton Michel are the brief's first calls. Also who in the five-person split owns this title |

## Engine-side (Claude): prepared 18 Sep 2026

| # | Step | Status | Notes |
|---|---|---|---|
| A | Source list: 30+ verified direct feeds | ✅ 18 Sep | **52 verified feeds seeded** (26 regulator/government incl. 9 gov.uk keyword and topic searches, 11 associations/research, 4 business and deal wires, 8 suppliers, 3 brokers/law) plus 6 verified feeds held back as parent-facing or stale. `docs/nursery-daily-sources.md`; `scripts/seed-nursery-daily-sources.mjs` (101 rows). No competitor publishes a readable feed (Nursery World 403, NMT none, CYP Now 403): six are seeded hub-only and flagged `Sector press (competitor)` |
| B | Content plan `scripts/batch-plan-nursery-daily.json` | ✅ 18 Sep | 12 briefs, 3 waves, every one with SOURCE ANCHORS pre-verified 18 Sep and structural requirements. Seven aim at the brief's §3 SERP gaps; five at SERPs checked 18 Sep (selling, pay bill, Ofsted changes, school-based nurseries, market size). **Canonical section list (the site's categories must be created with exactly these):** News · Funding & Fees · Deals & Valuations · Staffing & Pay · Compliance & Ofsted · Property & Premises · Operations & Tech |
| C | Search set | ✅ proposed | `NURSERY_DAILY_NEWS_SEARCHES`, 12 queries, below. **Not added to `lib/news-searches.js` or `SEARCH_SETS`** (shared files, per this wave's rules); merge it, then add `"nursery-daily": NURSERY_DAILY_NEWS_SEARCHES` to the map in `scripts/seed-news-searches.mjs` |
| D | Title seed `scripts/seed-nursery-daily-title.mjs` | ✅ written, dry-run clean | Engine OFF, status setup, $5/day cap, target 3/day, markets `["GB"]`, newsletter/LinkedIn/outreach OFF, authorEmail `news@news.nurserydaily.com`, 7 sections. Reads `scripts/alignment/nursery-daily.{audience.txt,editorial-standard.md,house-style.md}`. `--dry-run` against the live DB on 18 Sep: slug free, would create. **Not run for real** |
| E | Child theme `nursery-daily-website/child` | ✅ scaffold, committed locally | Ochre/ink/paper palette with a saffron accent, Zilla Slab Bold headings (no other title uses a slab), JetBrains Mono, text lockup "Nursery DAILY / THE BUSINESS OF EARLY YEARS", 7 section patterns, nav, home template. Declares `cogent_brand` (mailchimp_audience "Nursery Daily"), `cogent_home_sections`, `cogent_author_slug`, `cogent_directories` (funding-rate tracker + events). `git init -b main`, one commit, no remote |
| F | Editorial rules | ✅ proposed | Block below, for `docs/editorial-standard.md`. The same text in fuller form is already in the alignment file the seed reads |
| G | Title in `TITLES` + `CHILDREN` in `cogent-base-theme/scripts/check-title-agnostic.mjs` | ☐ | Shared file; not touched |
| H | Seed Site row, sources, searches | ☐ | Order: title seed, then sources, then searches (after C is merged) |
| I | WordPress: Yoast before first publish; Engine user (editor + app password); byline user | ☐ | After JB step 2 |
| J | Theme deploy, activate, `wp option update template cogent-base`, purge | ☐ | Parent 1.21.x first if this server has never had it |
| K | Funding Rate Tracker | ☐ planned | See below. The collection is declared in the child; rows need a data decision |
| L | `verify-title.mjs --site=nursery-daily` | ☐ | Not before step 8 is resolved |

---

## C. Proposed search set (for `lib/news-searches.js`)

Measured against Google News RSS, GB edition, on 18 Sep 2026. "In window" is
items actually dated inside the query's `when:` window; "usable" is my read of
how many an owner-operator would act on AND the safeguarding rule would let us
run.

```js
/**
 * Nursery Daily (nursery-daily). The consumer twin is the worst in the fleet:
 * operator intent is about 1% of "childcare" searches and about 12% of
 * "nursery" searches (docs/vertical-brief-nurseries.md section 4). So:
 *
 * NEVER seed bare `nursery`, `childcare`, `day nursery`, `nursery staff`,
 * `early years sector` or `30 hours childcare`. Every query is scoped to an
 * operator marker (acquisition, funding rate, planning, Ofsted framework,
 * workforce, fees as a provider).
 *
 * intitle: is used on the nursery beats because Google News matches words
 * anywhere on the publisher's page, and regional sites with "nursery" in their
 * menus flooded the untitled versions with unrelated local news.
 *
 * THE SAFEGUARDING RULE shapes the exclusions: harm to children is the
 * sector's lead story and never ours. NO_HARM thins it; it does not remove it,
 * and the rule itself, plus a human-review gate, is the actual guard.
 *
 * KEEP EVERY QUERY SHORT. Measured 18 Sep 2026: queries of roughly 200+
 * characters or with many OR terms silently lose their `when:` window and
 * return items years old. Every query below was checked to honour its window.
 *
 * Deliberate absence: no query feeds Operations & Tech. Vendor names return
 * Bayeux Tapestry and US daycare-fraud stories; that section is fed by the
 * content plan and the supplier feeds only. No appointments query either: the
 * scoped versions returned no UK nursery appointments in 14 days.
 *
 * `category` must match a section in scripts/seed-nursery-daily-title.mjs.
 */
const NO_PARENT = '-"near me" -rhymes -plant -garden';
const NO_HARM = '-died -abuse -trial -sentenced';

export const NURSERY_DAILY_NEWS_SEARCHES = [
  {
    name: "Wire: nursery openings and expansion",
    category: "News",
    query: `(intitle:nursery OR intitle:nurseries) (opens OR opening OR "new nursery" OR expands OR expansion) ${NO_PARENT} ${NO_HARM} when:7d`,
  },
  {
    // A single setting's closure after an Ofsted inspection is NOT ours under
    // the safeguarding rule; council and viability closures are.
    name: "Wire: nursery closures",
    category: "News",
    query: `(intitle:nursery OR intitle:nurseries OR intitle:"pre-school") (closure OR close OR closing) ${NO_PARENT} -store ${NO_HARM} when:7d`,
  },
  {
    name: "Wire: school-based nurseries and wraparound",
    category: "News",
    query: `("school-based nurseries" OR "school-based nursery" OR "school nurseries" OR "wraparound childcare" OR "maintained nursery") when:7d`,
  },
  {
    // 30 days, not 7: the deal flow is about one a week, and FeedItem is unique
    // on (siteId, link), so the wider window cannot duplicate.
    name: "Wire: nursery acquisitions",
    category: "Deals & Valuations",
    query: `(intitle:nursery OR intitle:nurseries) (acquires OR acquisition OR acquired OR "sold to" OR buys) -plant when:30d`,
  },
  {
    // Group-level regulatory notices from official sources ARE in scope under
    // the safeguarding rule, for their business consequence only, and only
    // with the human-review gate in place.
    name: "Wire: the large groups",
    category: "Deals & Valuations",
    query: `(intitle:"Kids Planet" OR intitle:"Busy Bees" OR intitle:"Bright Horizons" OR intitle:Storal OR intitle:Grandir OR intitle:Partou) -BFAM -NYSE -shares ${NO_HARM} when:14d`,
  },
  {
    name: "Wire: funding rates and funded hours",
    category: "Funding & Fees",
    query: `("early years funding" OR "funding rates" OR "funded hours" OR "funded childcare") (nurseries OR providers OR council) -fraud -daycare when:7d`,
  },
  {
    name: "Wire: fees and viability",
    category: "Funding & Fees",
    query: `(nurseries OR "childcare providers") (fees OR "top-up" OR "additional charges" OR "financial pressure" OR viability) ${NO_HARM} when:7d`,
  },
  {
    name: "Wire: Scotland, Wales and Northern Ireland",
    category: "Funding & Fees",
    query: `("early learning and childcare" OR "Flying Start childcare" OR "Childcare Offer for Wales" OR "funded childcare") (Scotland OR Wales OR "Northern Ireland" OR council) when:7d`,
  },
  {
    name: "Wire: workforce and pay",
    category: "Staffing & Pay",
    query: `("nursery staff" OR "early years staff" OR "early years workforce" OR "childcare workers") (pay OR wage OR recruitment OR shortage OR bonus) -US when:7d`,
  },
  {
    name: "Wire: Ofsted and early years regulation",
    category: "Compliance & Ofsted",
    query: `Ofsted ("early years" OR nurseries OR childminders) (framework OR inspections OR notice OR registration OR "report cards") ${NO_HARM} when:7d`,
  },
  {
    name: "Wire: EYFS, ratios and compliance cost",
    category: "Compliance & Ofsted",
    query: `(nurseries OR "early years settings") (EYFS OR ratios OR CCTV OR "safeguarding training") (government OR DfE OR cost OR consultation) ${NO_HARM} when:7d`,
  },
  {
    name: "Wire: planning and premises",
    category: "Property & Premises",
    query: `("day nursery" OR "children's nursery" OR "nursery for") ("planning permission" OR "planning application" OR "change of use" OR approved) when:7d`,
  },
];
```

| # | Query | In window | Usable | Share | What the rest was |
|---|---|---|---|---|---|
| 1 | Openings and expansion | 10 (7d) | 4 | ~40% | Abu Dhabi, Italy, Greece, a single setting's Ofsted grade |
| 2 | Closures | 10 (7d) | 3 | ~30% | A pre-school closed after an Ofsted inspection (off-limits), hospital neonatal units, Indonesian fish nurseries |
| 3 | School-based and wraparound | 5 (7d) | 3 | ~60% | Kentucky pre-K, a parent-money explainer |
| 4 | Acquisitions | 8 (30d) | 6 | ~75% | One single-setting closure, one architecture item. About 1.5 deals a week |
| 5 | The large groups | 8 (14d) | 3 | ~40% | Local Ofsted puff, bowling and agriculture "Busy Bees". The usable 3 were the Bright Horizons group-level notice, which needs the human gate |
| 6 | Funding rates | 6 (7d) | 3 | ~50% | Crypto "funding rates" (2) |
| 7 | Fees and viability | 6 (7d) | 2 | ~33% | Abu Dhabi, Jersey, a parents' top-20 list, a private school |
| 8 | Nations | 8 (7d) | 4 | ~50% | A Gaelic award, a doctor's medal, a parents' ranking |
| 9 | Workforce and pay | 1 (7d) | 0 GB | 0% | One Irish pay deal. Keep on watch; drop at the two-week re-measure if still empty |
| 10 | Ofsted regulation | 8 (7d) | 3 | ~40% | Single-school and single-nursery grades |
| 11 | EYFS, ratios, compliance cost | 2 (7d) | 2 | 100% | Low volume |
| 12 | Planning and premises | 5 (7d) | 4 | 80% | One "former nursery demolished for homes" |

**Net supply: about 20 unique usable items a week from Google News, roughly 3
a day once cross-query duplicates (the Bright Horizons notice appeared in three
queries) are removed.** That is barely the target on its own, and it is lumpy:
three of those twenty were one safeguarding story that cannot run without the
human gate. The 52 direct feeds, especially the gov.uk set, are what make
3/day sustainable. Re-measure after two weeks, per the brief.

**Fleet finding, not this title's to fix:** the same `when:` loss affects live
queries. Measured 18 Sep: barbering's "openings and expansion" (216 chars),
"grooming product and brand launches" (243) and "awards and competitions"
(212), and airports' "non-aero revenue and concessions" (239) and "traffic
results and financials" (250) returned 51 to 100 items with 0 or 1 dated in
the last 7 days. Whether the scan cron discards them by `publishedAt` decides
whether this is wasted scan budget or stale topics reaching the Researcher.
Worth a separate look in a COGENT session.

---

## F. Proposed per-title rules for `docs/editorial-standard.md`

Paste under "Per-title rules", after Airport Business Magazine. The fuller
text the engine actually reads is `scripts/alignment/nursery-daily.editorial-standard.md`.

```markdown
### Nursery Daily: five rules

**1. The safeguarding rule, which outranks everything else.** We do not
cover abuse, injury, death or neglect of children as news. Ever. No named
children, no named accused individuals, no named individual setting in
connection with harm. Regulatory enforcement is covered only at group or
policy level, only from an official source (Ofsted, DfE, a gov.uk notice, or a
court outcome after verdict), and only for its business consequence: what a
chain-level welfare notice means for operators, what mandatory CCTV would
cost, how insurance premiums move. A single setting's grade, suspension or
closure after inspection is not our story. Live criminal cases and
prosecutions are off-limits entirely, including a council-authorised
prosecution, because of contempt risk. Any draft that mentions a child's
death, abuse, injury or a criminal case goes to a human before publishing,
with no automatic path to publish. When in doubt, the piece runs without the
detail or does not run.

**2. The buyer rule.** Every article is written for someone paid to run a
setting: owner, director, nursery manager, childminder as a business,
pre-school chair, out-of-school club operator, group operations or finance
lead, investor, lender, broker, supplier. If the natural reader is a parent,
it is not our article: no "how to choose a nursery", no "how to claim 30
hours", no child-development tips, no nursery rankings for parents. Parents
enter our pages only as demand data. Operator intent is about 1% of
"childcare" searches and 12% of "nursery" searches, the worst consumer twin in
the fleet, so the engine is never seeded with `nursery`, `childcare`, `day
nursery`, `nursery staff`, `early years sector` or `30 hours childcare` bare.

**3. The no-children-imagery rule.** No AI-generated images of children and no
stock photos of identifiable children. Buildings, empty rooms, outdoor spaces,
kitchens, adults at work, data graphics.

**4. The nation-and-scope figure rule.** Funding, ratios, entitlements and
regulators differ across England, Scotland, Wales, Northern Ireland and
Ireland, and English council rates vary about 54%. Every figure carries
nation, source, year and scope, or is quoted as a range. A national average is
always called an average. Market-size figures differ by definition (day
nurseries only versus all registered childcare): name the firm and the scope.

**5. The politics rule.** Funding is a live political fight. Cover it as
economics: rates, costs, margins, capacity, cashflow. No party line, and no
campaigning voice borrowed from the sector bodies; attribute theirs beside the
government's.
```

---

## K. The Funding Rate Tracker (planned, not built)

**The framework supports it cheaply.** `cogent-base/inc/directory.php` is
exactly the right primitive: one `cogent_entry` per council, a sortable real
`<table>` index, a crawlable page per council, `money` columns that sort as
numbers, blanks rendered as unknown rather than zero, and a checked date per
row with the oldest shown on the index. The collection `funding-rates` is
already declared in the child's `functions.php` (columns: region, 3 and
4-year-old rate, 2-year-old rate, under-2 rate, year; grouped by region). It
renders nothing until rows exist and a page carries its shortcode.

**What is left, in order:**

1. **A decision (JB):** `scripts/seed-directory.mjs` states a data rule that
   every value came out of an article the title itself published. These rows
   would come straight from the DfE's published 2026-27 rate tables, with the
   gov.uk URL as every row's `source_url`. Primary source, better than an
   article, but it is a change to a stated rule.
2. Download the DfE's LA-level 2026-27 rate table from gov.uk (a spreadsheet;
   the easy explainer links "step-by-step tables" and a technical note but
   quotes no council rates itself). Needs JB's OK as a file download.
3. Convert it to the seed JSON (151 rows, values exactly as published), run
   `seed-directory.mjs --site=nursery-daily --collection=funding-rates --dry`,
   then for real once the site exists.
4. Create the `/funding-rates/` page with the directory shortcode, link it from
   the nav and footer, and link it from wave 1's funding-rates article (which
   already promises the tracker without a date).
5. Wales, Scotland and Northern Ireland as separate collections or a later
   column, since their systems are not per-hour council rates in the same
   sense.

Pass-through and payment-timing columns are deliberately absent: the DfE
tables do not publish them per council, and the data rule forbids guessing.

---

## Shared changes this title needs (none made)

1. **Human-review gate** (the STOP section above). Launch blocker.
2. Add `NURSERY_DAILY_NEWS_SEARCHES` to `lib/news-searches.js` and
   `"nursery-daily"` to the map in `scripts/seed-news-searches.mjs`.
3. Add the F block to `docs/editorial-standard.md`.
4. Add Nursery Daily to `TITLES` and `CHILDREN` in
   `cogent-base-theme/scripts/check-title-agnostic.mjs`.
5. A brand-kit spec in `cogent-base-theme/scripts/brand/specs.mjs` for the
   drawn masthead and tab icon (Zilla Slab, ochre). Until then the
   parent's CSS text lockup and generated favicon are used.
6. `lib/reachability.js` has no nursery coverage; add the obvious
   non-responders (Busy Bees, Bright Horizons, the national operators) before
   outreach is ever switched on.
7. Register this title's target terms in the keyword registry against Smart
   SME (brief §12 item 6).
8. Rerun `scripts/build-brand-palettes.mjs` once the child is deployed so the
   newsletter takes this title's palette and face.

## Open questions and watch list

- **Human review:** the blocker. Who clicks approve every day, and what the
  target becomes if nobody can.
- **Byline person:** the brief makes it a launch requirement. Placeholder is
  `james-burke`.
- **Ireland:** the two Irish feeds (Early Childhood Ireland, Pobal) are seeded
  because the brief recommends UK and Ireland at launch, but `markets` is
  `["GB"]`. Keep or drop.
- **Palette collision within the wave (found and fixed, one still open):**
  this title was first drafted in plum with Playfair Display, then checked
  against the other four wave scaffolds on disk. Senior Living Business had
  already taken plum (#4E2A51) with Playfair Display, so Nursery Daily moved to
  ochre with Zilla Slab. Still open between two siblings, not this title:
  Gym Business News (#C0431A) and Smart Farming News (#C2410C) are both burnt
  orange with Barlow Condensed headings.
- **Heading font file:** Zilla Slab Bold ships as the brand kit's 270KB TTF.
  A woff2 conversion would roughly halve it; no converter was available
  without a download.
- **Brief correction:** the brief (§1) says sellers were "racing" the Business
  Asset Disposal Relief rise. Christie and Co's Business Outlook 2026 page, as
  fetched 18 Sep, attributes 2025's 3.8% price rise to competitive bidding and
  does not mention the relief. The plan's selling brief is anchored to what
  the page says.
- **Brief detail:** Christie's H1 2026 split is 61% large groups, 23% medium,
  16% first-time or single-setting (the brief quoted 2025's 62/17/21). Both
  may be right for their periods; the plan uses H1 2026 only.
- `nurserybusiness.com` was in pending delete per the brief; not relevant
  now the name is Nursery Daily, but the .co.uk of this name was not bought
  and anyone can take it.
- Newsletter, LinkedIn and outreach all seeded OFF; switch on deliberately.
  Outreach not before about 20 published articles.
