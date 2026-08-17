# The Fleet Magazine — launch pack

Title #2. Everything here is paste-ready. Work top to bottom; the order is a
dependency order, not a suggestion.

- **Name:** The Fleet Magazine
- **Domain:** thefleetmagazine.co.uk (confirmed available at Nominet, 17 Aug 2026)
- **Slug:** `fleet-magazine`
- **Byline mode:** `per_title_person` — its own named editor
- **Strategy:** enter at the van/LCV end, where Bauer retired `commercialfleet.org`
  into a redirect and the remaining titles rank 2.5m and 2.8m on Tranco. Widen to
  company cars once there is a base.
- **Why the brand is broader than the wedge.** The van position is a *competitive*
  argument — it is where the incumbents are weakest. It is not where the traffic
  is: 42% of the 5,501-query demand map is company car tax, EV transition and
  salary sacrifice, all car topics. A van-locked masthead would have fought its
  own demand, so vans are the editorial entry point and not the name.

---

## 0. What changed in the app before this was possible

Five things were wrong. Four were on the audit's own "before title #2" list; one
was not, and was the real blocker.

| Fix | Why it mattered |
|---|---|
| **Agent prompts de-hardcoded from Smart SME** | `researcher.js` and `team.js` instructed agents to strike out "content aimed at large corporates". On a fleet title that rejects Fleet200 operators — the most valuable audience in the sector. `drafting.js` wrote for "a small business", and the newsletter footer was hardcoded to "UK small businesses" in every email sent. |
| **`bylineMode` honoured at publish** | It was stored by the wizard and read by nothing. All three modes published identically, as whoever held the application password. `lib/wordpress.js` now resolves an author over `/wp/v2/users` and fails soft. |
| **Cold start wired up** | `isColdStart()` was exported and called by nothing. The Researcher now says so in its run log, tells the model that an empty Search Console is expected rather than a failure, and promotes the title to `live` the day GSC returns real rows. |
| **`setup` → `cold_start` promotion** | Nothing in the app moved a title off `setup`, and `lib/cron.js` only picks up `live` or `cold_start`. Title #2 would have sat with its engine ticked on, running nothing, with no error to explain why. Switching the engine on now performs the promotion. |
| **Manual Publish button was a silent no-op** | `publishArticle()` called `isWordPressConfigured()` with no argument — always false. The WordPress block was skipped entirely and the article was then marked `published` with a null `wpPostId`. This is a live bug on Smart SME today, not just a title #2 problem. |

Two more, smaller: the SiteGround captcha and the byline account are now steps on
the provisioning checklist, and `FLEET_NEWS_SEARCHES` has been added to
`lib/news-searches.js`.

---

## 1. Paste into the New Title wizard

`/new-title`

| Field | Value |
|---|---|
| **Title name** | `The Fleet Magazine` |
| **URL slug** | `fleet-magazine` |
| **Strapline** | `Practical intelligence for the people who run UK vans, trucks and company cars.` |
| **Domain** | `thefleetmagazine.co.uk` |
| **Mark text** | `FM` |
| **Byline** | Own named editor |
| **Author name** | *see §5 — this must be a real person* |
| **Editorial intake address** | `news@thefleetmagazine.co.uk` |
| **Accent** | The amber preset (`#d97706` / `#fbbf24`) — visually distinct from Smart SME's blue in the rail |

**Readers.** This is the single most load-bearing field in the system: every
agent prompt opens with it and the Researcher commissions against it. It is
deliberately written to span small operators *and* large corporates, because the
prompt bug fixed above came from exactly that ambiguity.

```
UK fleet managers, transport managers and operations directors responsible for vans, trucks and company cars — from owner-operators running ten vehicles to corporate fleets of several thousand — together with the finance, HR and procurement people who share those decisions.
```

**Sections**, comma separated. These map one-to-one onto the `category` values in
`FLEET_NEWS_SEARCHES`, so a mismatch silently drops the Researcher's hints:

```
Vans & LCV, Electric & Charging, Tax & Legislation, Compliance & Safety, Leasing & Funding, Telematics & Technology, Costs & Efficiency
```

News and Case Studies are added automatically and are never commissionable.

---

## 2. Paste into Settings after creation

### Editorial standard

The tier rule is the existing system's, unchanged: every format sits in one tier
by how much external truth it needs, and **an agent may never promote a format up
a tier.** What is new is the figure rule, which exists because fleet content is
financial-decision adjacent — a wrong BiK percentage is somebody's five-figure
vehicle decision, and Google applies elevated quality standards to this territory.

```markdown
# The Fleet Magazine editorial standard

## The figure rule, which outranks everything else here

Fleet readers act on numbers. A wrong tax band, threshold, rate or deadline is
not a typo — it is a reader making a five-figure decision on our word.

- Every tax rate, BiK percentage, mileage rate, threshold, grant value and
  statutory deadline must be traceable to a named official source: HMRC, DVLA,
  DVSA, the Traffic Commissioners, HM Treasury, DfT, or the published legislation.
- State the tax year or effective date alongside every rate. "The BiK rate is 3%"
  is wrong within months; "3% in 2025/26, rising to 4% from 6 April 2026" is not.
- If the official figure cannot be confirmed, describe the mechanism and link to
  the source rather than quoting a number. A general sentence is always better
  than a confident wrong figure.
- Never carry a rate forward from an older article without rechecking it.
- Never present a calculation as advice. Show the arithmetic and name the
  assumptions.

## Tiers

**Tier 1 — needs only a topic.** Explainers, how-to guides, comparisons of
publicly documented products, roundups of published rules. Written from public
sources. Subject to the figure rule above.

**Tier 2 — needs a real, publicly reported event.** News, rewrites of
announcements, coverage of policy changes, appointments, contract wins, results.
Must be tied to a specific item actually on the wire, with a link to the source.
News cannot be commissioned into existence.

**Tier 3 — needs a real named person or organisation who took part.** Case
studies, interviews, fleet profiles, quoted opinion. Requires a real situation
that was publicly reported, or a person who actually consented. Never invent a
fleet manager, a quote, a vehicle count or an operator.

An agent may never promote a format up a tier. If the evidence for a tier 3 case
study does not exist, the piece becomes a tier 1 explainer or it does not run.

## Sector-specific rules

- Distinguish cars, vans and trucks explicitly. "Fleet" alone is ambiguous and
  the tax, licensing and compliance regimes are entirely different.
- Never imply an operator size the source does not support. This title serves
  ten-vehicle operators and three-thousand-vehicle corporates alike.
- Name manufacturers, suppliers and leasing companies where relevant. Every
  company named is a company the Backlink Manager can approach.
- UK only. Do not carry US or EU fleet rules across without saying so.
- Treat any supplier claim about savings, range or uptime as a claim, attributed
  to the supplier, never as fact.
```

### House style

```markdown
# The Fleet Magazine house style

Write for a working fleet manager between two jobs. They are technically
literate, time-poor, and being sold to constantly by everyone else in their inbox.

- Lead with the consequence, not the context. What changes, what it costs, by when.
- UK spelling. Sterling. Metric except where the industry uses imperial (mpg, tonnes).
- Expand every acronym on first use: BiK, LCV, SMR, AFR, AER, ZEV, O-licence, WLTP.
- Never use em dashes.
- No supplier adjectives. "Leading", "innovative", "best-in-class" and "solution"
  do not appear in our copy, including inside rewritten announcements.
- Numbers get context: a rate change gets an annual cost for a real example vehicle.
- Short paragraphs, two to four sentences.
- End guides with a short "What to do next" of three or four concrete steps.
```

### Engine settings

Start conservative. Fleet is a smaller, higher-value audience than SME, and the
figure rule above means a wrong article costs more here than a missing one.

| Setting | Value | Why |
|---|---|---|
| Articles per day | `1` | Raise once the figure rule is holding in QA |
| Office hours | `7`–`20` | UK wall clock, as Smart SME |
| Daily spend cap | set one | Marginal engine cost is ~£33/month; a cap catches a runaway loop |
| Newsletter | **off** | Until the sending domain is authenticated |
| LinkedIn | off | Turn on once the company page exists |
| Outreach | **off** | Until MX is on Google, or reply detection is blind |

---

## 3. The provisioning checklist

Fourteen steps, created automatically on the title's settings page. **Blocking**
steps will break something silently if skipped.

| # | Step | What you do | What comes back |
|---|---|---|---|
| 1 | **Domain** *(blocking)* | Register `thefleetmagazine.co.uk`, point nameservers at SiteGround | — |
| 2 | **MX, SPF, DKIM** *(blocking)* | Point MX at Google, publish SPF and DKIM | — |
| 3 | **WordPress** | Install WP, clone the Smart SME block theme | Site URL |
| 4 | **Plugins** | sg-security, siteground-optimizer, Yoast, Site Kit | — |
| 5 | **SiteGround captcha** *(blocking)* | Exempt `/wp-json/` from the sg-security captcha | — |
| 6 | **Categories** | Create categories spelled *exactly* as the seven sections | — |
| 7 | **Engine user** | New user, **Editor** role, generate an application password | `username`, `appPassword` |
| 8 | **Byline user** | New user whose **display name exactly matches** the author name | — |
| 9 | **Intake page** | Publish `/submit-news/`, monitored at `news@thefleetmagazine.co.uk` | — |
| 10 | **Search Console & GA4** | Add the property to both, grant the service account | `gscSiteUrl`, `ga4PropertyId` |
| 11 | **Mailchimp** | Create the audience, authenticate the sending domain | `audienceId`, `fromEmail` |
| 12 | **LinkedIn** | Create the company page, run the OAuth connect flow | `organisationUrn` and tokens |
| 13 | **Credentials** | Paste into `/s/fleet-magazine/settings`, pass the health probe | — |
| 14 | **Seed content** *(blocking)* | Publish 3–5 articles by hand | — |

### Gotchas that have already cost us once

- **Step 5 is why this list exists.** `sg-security` serves a captcha interstitial
  on `/wp-json/` and returns **202, not a 4xx**, so any check on `res.ok` sails
  straight past it. The credential light goes green and every publish fails.
- **Step 7 must be Editor, never Administrator.** Correct behaviour is
  `rest_forbidden` on `/wp/v2/settings`. Site settings stay a human job.
- **Step 8 is new.** Publishing now resolves the byline by display name. If that
  user does not exist the publish still succeeds — carrying the Engine account's
  byline on every article until somebody notices.
- **Step 10 grant address:**
  `smart-sme@smart-sme-504113.iam.gserviceaccount.com`
  (client id `103477294297350245247`). Domain properties use the `sc-domain:` form.
- **Step 14 is blocking for a real reason.** Drafts need existing posts to link
  to; internal links are mandatory and QA holds an article that has fewer than two.

### Then, to start the engine

Tick **Engine enabled** in Settings. That now promotes the title from `setup` to
`cold_start` and stamps `launchedAt`. The Researcher moves it to `live` on its own
the day Search Console returns real rows.

---

## 4. The fleet newswire

`NEWS_SEARCHES` in `lib/news-searches.js` is Smart SME's wire — every query
hardcodes `"small business" OR SME`. Seeding The Fleet Magazine from it would fill the
newswire with the wrong sector.

`FLEET_NEWS_SEARCHES` is now in the same file: twelve standing Google News
searches chosen against the demand clusters in the business case, weighted toward
tax and BiK, EV transition and salary sacrifice, plus an appointments search to
feed a Movers column.

**Before running the seed script, read this.** `scripts/seed-news-searches.mjs`
predates multi-tenancy: it uses a bare `PrismaClient`, matches `prBrand` rows on
name alone with no `siteId`, and creates them with no `siteId` either. It needs a
`--site` argument and tenant scoping before it can safely seed title #2. That work
is not done and is the one remaining code task before launch.

---

## 5. Decisions still open

1. **Which domains to buy.** Three separate decisions, in this order:
   - **Enquire about `fleetmagazine.co.uk` first.** Registered 25 July 2026 via
     Namecheap, on Cloudflare, currently 301-redirecting to an unrelated heritage
     site. It is parked, not a competitor, and three weeks old — very likely
     buyable. Owning the exact match is worth more than the price difference, and
     `thefleetmagazine.co.uk` would then redirect into it.
   - **Buy `.co.uk` and `.uk` together** whichever way that goes. Leaving the
     sibling TLD open is exactly how someone shadows the brand later.
   - **Trademark check before spending.** "Fleet Magazine" sits close to Fleet
     World's own `fleetworldmagazine.co.uk`, and the wider UK set also includes
     `fleetmanagementnews.co.uk` and *Essential Fleet Manager*. None are strong,
     but the name is generic enough to be worth ten minutes on the IPO register.
2. **Vehicle data.** The market leader's biggest asset — a car tax calculator at
   ~80,000 page impressions a month — runs on licensed Solera cap hpi data. The
   free path (DVLA Vehicle Enquiry Service, VCA fuel-consumption data, HMRC's own
   BiK tables) supports a genuinely useful calculator without derivative-level
   P11D coverage. Price the licence before choosing.
3. **Ahrefs, one month, ~£99.** Converts the 5,501-query demand map into real
   volumes before the section taxonomy is locked.
4. **Launch timing.** The business case recommended gating the launch date on a
   Smart SME signal — an inbound press-release flow and one paying advertiser —
   rather than on the vertical decision. That gate is unchanged by any of the work
   above; everything here is preparation, and nothing published.
