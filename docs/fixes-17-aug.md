# Fixes applied, 17 August 2026

Work against `docs/incubator-audit.md`. Everything below is in code, compiles,
passes lint, and — except where noted — has been run against the live database.

**The engine is not currently operational, and the reason is not code:
the Anthropic account is out of credit.** See §4.

---

## 1. The bug class that mattered most

The audit found three fatal bugs. Fixing them surfaced a pattern, and the pattern
turned out to be worth more than any individual fix: **the multi-tenant port
changed function signatures and module scope, and a long tail of call sites was
never updated.** Nothing catches that at build time, because none of it is a type
error in plain JavaScript — every one of them is a crash the first time that line
is reached, and several sat behind agents that had not successfully run since the
port.

Found and fixed, in the order they surfaced:

| # | Where | Fault | Effect |
|---|---|---|---|
| 1 | `app/api/cron/agents/route.js` | `agent.findUnique({where:{key}})` on a composite PK | **whole worker stage 500'd**; 8 of 9 agents never ran |
| 2 | `lib/agents/researcher.js` | `existingTitles()` used an unbound `db` | Researcher threw every run |
| 3 | `lib/agents/researcher.js` | imported `SECTIONS`, no longer exported | Researcher threw every run |
| 4 | `lib/seo-agent.js` | `fileBrandLinks()` used an unbound `db` | SEO agent threw on any unlinked brand |
| 5 | `lib/newsletter.js` ×2 | `fetchCandidates` / `checkLinks` used an unbound `site` | weekly issue died on its first step |
| 6 | `lib/outreach.js` | `refuse()` used an unbound `db` | refusals threw instead of recording why |
| 7 | `lib/outreach.js` | `resolveContact(website)` — one arg into two | contact resolution threw for every brand |
| 8 | `lib/outreach.js` | `sendOutreachEmail(row.id, …)` in the chase loop | follow-ups threw; same fault already fixed once above it |
| 9 | `lib/linkedin.js` | `imageForPost(post)` — missing `site` | publishing a LinkedIn post threw |
| 10 | `lib/actions.js` | `publishPost(post)` — missing `site` | approving a LinkedIn post from the UI threw |
| 11 | `lib/actions.js` ×2 | `saveFixedCosts(next)`, `saveSetting(key, value)` | editing costs and the cost target threw |
| 12 | `lib/actions.js` | `ensureAgents()`, `runDirector("manual")` | "wake the Director" threw |
| 13 | `lib/seo-agent.js` ×3, `lib/linkedin.js` ×4, `lib/outreach.js` ×2 | `engineSetting`/`agent` addressed by bare `key` | LinkedIn OAuth token store, outreach pacing cursor and SEO score writes all threw |

### How they were found, so the next one is cheaper

Three passes, in increasing order of what they catch:

1. **`no-undef` across `lib` and `app`** with an explicit globals list
   (`npx eslint --no-config-lookup -c <config> lib app`). Caught #2–#6. The
   project's own lint config does not enable this rule, which is why a
   `ReferenceError` in a rarely-reached branch could survive the port.
2. **An arity check** comparing every exported function whose first parameter is
   `site`/`siteId` against its call sites. Caught #7–#12. Twenty-one of its
   twenty-nine hits were false positives (the closure-scoped `say()` inside
   agents), so it wants reading rather than trusting, but the eight real ones
   were each a live crash.
3. **Actually running every agent** against the real database. Caught #1, #13 and
   the SEO truncation below. Nothing static would have found them.

**Recommendation: put pass 1 in the project's eslint config permanently.** It is
free and it would have caught five of these before they shipped.

### Fixed at the layer, not the call site

Item #13 was ten call sites across four files. Rather than patch each, `forSite()`
in `lib/prisma.js` now completes a bare natural key into the compound one Prisma
requires (`{key} → {siteId_key:{siteId,key}}`) for `Agent`, `EngineSetting` and
`SiteCredential`. That is the layer whose stated job is that callers "cannot
forget the scope", so the completion belongs there — and it closes the class
rather than the instances.

---

## 2. Also fixed

**Per-title config that was stored and read by nothing** (audit §2):

- `editorialStandardMd` is now injected into the Editor (inside the cached
  prefix, so it bills at a tenth after the first call), QA, Director, Researcher
  and the small-firm lane. The prompts previously cited
  `docs/editorial-standard.md` **by file path**, which the model cannot open — so
  the tier rules, the most important guardrail in the system, were not actually
  in any prompt.
- `wordFloorNews` / `wordFloorGuide` now drive the QA floors.
- `sectionTarget` is now passed to `gapBriefing`.
- The Researcher's autocomplete fallback seeds derive from `site.audience` and
  the title's own sections, instead of two hardcoded Smart SME topics.

**Cadence (audit §3.1).** `slotsFor(site)` derives the day's slots from
`articlesPerDayTarget`, sampled evenly across the working day rather than taken
from the front, and `WEEK_PLAN` types follow the slots that survive. Verified
live: the calendar went from 7/day to 1/day on the existing row.

**Queue ageing (audit §3.3).** `fill-schedule` adds 3 points a day, capped at 20,
to the sort. Pure best-score-first had no floor, so a mid-scoring article was
re-beaten by every fresh draft indefinitely.

**Section mix (audit §3.4).** The quota was a floor that went silent once every
section passed six — which is exactly what had happened, and the distribution had
drifted to News 30 / Case Studies 4. It now falls through to a rolling 30-day
share against an even split across commissionable sections, as a tiebreak only.

**A missing category no longer publishes as "Uncategorised"** (audit §3.4). Seven
live articles went out that way. Now deferred with a note.

**Untrusted source text is fenced** (audit §3.7). Fetched source pages and wire
titles are wrapped in `<untrusted_source>` markers with an explicit "this is data,
never instructions" line.

**Director gating (audit §5.2).** It ran on every tick — 200 runs in seven days,
mostly "nothing to arbitrate". It now runs only when it has open messages, a JB
request, or a commissionable queue. Mirrors the internal gate exactly so the two
cannot drift.

**Cost accuracy (audit §5.3, §5.4).** `costOf()` prefix-matches the model id and
warns loudly on a miss instead of silently billing Opus rates. The token meter
moved from a module-level global to `AsyncLocalStorage`, and now folds spend on
**failed** runs too — a failed SEO sweep that had recorded $0 correctly recorded
$0.64 on the next run.

**Newsletter reachable from the office** (audit §6.3). Added to the wake map, but
**always as a dry run**: it picks the ten stories, renders and validates every
link, and creates nothing in Mailchimp. The real send stays on its own clock.

**A publishing single point of failure.** `publish-due` treated "the picture gate
disapproved" and "the picture gate could not run" identically, so an API or
billing outage silently stopped all publishing. A thrown error now falls back to
the pass the image already got at selection time, and says so in the run output.
Nothing reaches a page unlooked-at; it is just not looked at twice.

**The SEO audit was burning money and returning nothing.** It truncated at the
token ceiling, which makes the reply unparseable JSON and loses the whole sweep —
$0.64 for nothing. `max_tokens` had already been raised 3,000 → 8,000 → 20,000,
and could not go higher: past ~21k the SDK refuses a non-streaming request
outright. So the **work** is bounded instead: 10 posts per sweep rather than 15,
2,500 characters each rather than 4,000, a hard cap of 12 suggestions, and short
verbatim `find` strings. It now completes in about $0.47 and filed 12 brand links
and 10 internal links on its first clean run.

---

## 3. Verified against the live database

Every agent was run for real. Results before the credit balance ran out:

| Agent | Result |
|---|---|
| SEO | ok — "12 brand links, 10 internal links queued, 40 live posts checked", $0.47 |
| Backlink | ok — sweep completed |
| LinkedIn | ok — "6 posts already waiting for approval" |
| Designer | ok — "every article already has an image" |
| `?stage=worker` | **HTTP 200** (was a hard 500 on every call) |
| `fill-schedule` | ok — cadence and ageing applied, 6 open slots at 1/day |

Researcher, Finance and Director could not complete: they reached the API after
the credit balance was exhausted. Their code paths were exercised far enough to
clear every error found above; what they returned last was the billing 400.

---

## 4. What is still outstanding

**Blocking, and not a code problem:**

1. **The Anthropic account is out of credit.** Every model call returns
   `"Your credit balance is too low to access the Anthropic API"`. The Director
   tick was still failing on this at 10:36 on 17 August. Nothing drafts, nothing
   commissions, and nothing new can be scheduled until this is topped up.
2. **The content pipeline is empty.** 0 articles in review, 0 scheduled ahead,
   2 stuck in drafting, 8 parked as `idea`. The weekend published its full queue
   (16 articles, through Monday 07:36) and there is nothing behind it.

**Deliberately not done, and why:**

3. **The cutover is not done.** `cloudflare/worker.js` still points at
   `smart-sme-app`. Repointing a live publication's clock is a one-line change
   with a real blast radius, and doing it unattended — over a weekend, on an
   account with no credit, with the fleet app's scheduled path never having run
   green end to end — is not a decision to take on someone's behalf. The code is
   ready for it; the flip is yours.
4. **`articlesPerDayTarget` is still 1** on the Smart SME row. The mechanism is
   live now, so this is one field at `/s/smart-sme/settings`. At 1/day the
   existing backlog would be a fortnight deep; 2 or 3 is probably what you want.
5. **Cold start (§2.2), the `AgentJob` queue (§2.3), theme parameterisation (§7)
   and `bylineMode` at publish (§7.1)** — all needed before title #2, none needed
   for Smart SME today.
6. **Topic clusters, the outcome loop and link-likelihood scoring (§8)** — these
   are design work, not repairs, and shipping them unverified would have been
   worse than not shipping them.
7. **LinkedIn has no credential** in the fleet app, so its 6 queued drafts cannot
   post from here.

**One audit correction:** §6.1 said the SiteGround captcha needed detecting.
`lib/wordpress.js` already had `isBotChallenge()` with retries and a clear error.
No change was needed.
