# Editorial standard

The formats Smart SME publishes, and the rules for each. Derived from a
competitive analysis of the UK SME trade press, 2 August 2026 (full working in
`smart-sme-website/docs/competitor-analysis-full.md`).

This file is the reference the agent prompts cite. Edit it here rather than
inline in `lib/agents/*` — the formats will change more often than the code.

---

## Why this exists

A snapshot of the market found Smart SME publishing **0% brand news** against
85% at Business Matters and 60% at SME Business News. We were the only title in
the set with no news product at all, and we appear on no UK SME media list, so no
PR flow reaches us.

The important finding: the competitors' news is **not** expensive original
journalism. Traced back to source, it is two repeatable inputs — inbound PR
published fast, and rewrites of stories broken elsewhere angled at an SME
reader. Both are already within this engine's reach. The gap was supply, not
capability.

---

## The three tiers

Every format sits in exactly one tier, defined by **how much external truth it
needs before it can exist.** An agent must never promote a format up a tier.

| Tier | Needs | Autonomy | Formats |
|---|---|---|---|
| 1 | Nothing but a topic | Full | Evergreen guides |
| 2 | A real event on the wire | Full, once the event lands | News rewrites, movers briefs |
| 3 | A real named person who consented | Human in the loop, always | SME Movers spotlight, interviews |

Tier 2 and 3 cannot be manufactured to hit a quota. This is already encoded in
`lib/sections.js` as `MANUFACTURED = { "News": false, "Case Studies": false }` —
that guard is correct and must stay. The fix for an empty News section is more
supply into `PrBrand` / `FeedItem`, never a relaxed quota.

---

## Format 1 — Evergreen guide (tier 1)

The existing house format. 1,200–1,800 words, comparison table where tools are
compared, FAQ of 4–5 real questions, "What to do next" steps.

Unchanged. It is a genuine asset — no competitor in the market has this depth,
and it is what lets our analysis beat theirs. Keep producing it. Just stop
leading the homepage with it.

---

## Format 2 — News rewrite (tier 2)

`type: pr_rewrite`. 350–500 words. Fires when a `FeedItem` lands that a UK SME
owner would actually change a decision over.

Dissected from a live Business Matters article (~700 words, 11 paragraphs,
4 quoted sources, 15+ internal links):

- **Headline carries two hooks** — the action *and* a number. Not one or the
  other.
- **Standfirst**: a single sentence holding the whole story, including a quote
  fragment from a named person.
- **Lede repeats the standfirst almost verbatim.** The second sentence is
  concrete and physical.
- Paragraphs of two to four sentences.
- **The SME angle is the only original element.** Business Matters adds two named
  UK voices the original coverage did not have. That addition is the entire
  reason their version exists rather than the one they rewrote.
- Heavy internal linking. We under-use this badly.

**Never invent a quote or a commentator to satisfy the "two named voices" rule.**
If no real commentary is available, the piece runs without it and is shorter.
A fabricated source is a failure of the job, not a stylistic shortfall.

---

## Format 3 — SME Movers spotlight (tier 3)

**A monthly spotlight on one UK business owner and what they are building.**
Modelled on MEPCA's manufacturing champion of the month.

This is the differentiator. Every competitor can rewrite a press release; none
of them is having a real conversation with a named owner. It is also the format
that creates commercial relationships, because the subject's company now knows
who we are — and their marketing budget is the same budget that buys advertising.

### The hard rule

**This format cannot be generated.** It requires a real, identifiable business
owner who has agreed to take part and whose words are their own. An agent may
never write a spotlight from inference, from a LinkedIn profile, or from a
company's marketing copy. No nomination and no answers means no spotlight that
month — an empty slot is correct, an invented one is a serious failure.

### What the engine does

- Shortlist candidates from `FeedItem`, Companies House filings, award
  shortlists and regional coverage, with a one-line case for each
- Draft the question set, tailored to that owner's business
- Write the piece **from the answers actually returned**
- Source and verify imagery; the owner's own photograph is preferred
- Schedule, and queue the LinkedIn post

### What a human does

- Choose the champion
- Approve and send the questions
- Verify every quote against what was actually said
- Confirm the subject has seen and agreed to the piece

### Shape

800–1,200 words. Named byline, always.

1. **The hook** — the specific thing this owner is doing that is worth a reader's
   attention. Not "meet Jane, who runs a bakery."
2. **The business** — what it is, where, how big, how long.
3. **The turn** — the decision, risk or change that makes this a story.
4. **In their words** — extended direct quotes. This is the centre of the piece.
5. **What other owners can take from it** — the practical transfer.
6. **Where to find them** — company name linked to their site.

That last line is not a courtesy. It is the same backlink mechanic that makes
the roundup format work: it is why people say yes, and why they share it.

---

## Format 4 — Reaction roundup (tier 2/3)

Monthly. The highest output-per-effort format found anywhere in the analysis: one
question asked publicly, dozens of answers returned, each contributor credited
with name, job title, and **company name hyperlinked to their site**.

A live example ran 5,500–6,000 words across 32 contributors, with one subheading
and no conclusion. Contributors participate for the publicity and the backlink,
which costs us nothing.

Same hard rule as format 3: **real contributors, real words.** The engine can
draft the question, collect and order the responses, and lay the piece out. It
may not write a contribution or attribute one to a person who did not send it.

---

## Standing rules across every format

- **Named bylines on everything.** PRs pitch people, not addresses. Every title
  on the PR media lists has a named editorial contact; titles without one are
  unpitchable by construction, which is part of why no PR flow reaches us.
- **Never invent a statistic, a source, a quote or a commentator.** This predates
  the analysis and outranks everything in it.
- **Link out to the company and the original announcement** on any news piece.
- **No em dashes or en dashes**, per house style.

---

## Per-title rules

Each title carries a load-bearing rule that exists because that sector has one
way of going wrong that the standing rules above do not catch. They are not
style preferences. Breaking one is a hold, not a note.

### The Fleet Magazine — the figure rule

Any tax, BiK, rate or allowance figure is somebody's five-figure decision. Every
one is sourced to the publishing body, dated to the tax year, and never carried
over from a previous article.

### Golf Resort Magazine — three rules

**1. The buyer rule.** Every article is written for someone who is *paid* to be
at a golf resort: owner, investor, GM, director of golf, course manager,
developer, architect, tour operator, supplier. If the natural reader is someone
on holiday, it is not our article.

No course reviews. No "best of" or bucket-list destination lists. No travel
guides. No tournament reporting except where it is a business story about the
host venue.

This is the title's single most important rule and it is a commercial rule, not
a taste one. Golf is the first vertical where the consumer twin is the entire
category: Golf Digest sits at Tranco 17,994 and GOLF.com at 26,097, against a
golf trade press that runs from 458,746 down to 2,487,655. Drifting consumer
means competing with domains a hundred times stronger on their own ground, and
losing permanently. Roughly half the raw newswire is travel and tournament
content, so the pull toward that mistake is constant and mechanical.

The keyword exclusions in `lib/news-searches.js` thin this noise; they do not
remove it, and Google's negative operators demonstrably leak. The Researcher is
the guard.

**2. The market-size rule.** Published valuations of the golf tourism market
vary by more than 4x between research firms — $6.9bn to $30.6bn for the same
year. Always name the firm and the year, or quote the range. Never assert a
single market size in our own voice.

**3. The geopolitics rule.** Saudi PIF money runs through this sector, and
Trump-owned properties are simultaneously golf venues and US political stories.
Cover both as business: capital, capacity, bookings, contracts, ownership. Do
not editorialise on human rights or US domestic politics. A title with no named
political correspondent has no standing to take a side, and taking one costs
advertisers on both flanks.

Note the deliberate exception: the environmental critique of golf — water, land
use, chemicals — **is** ours to cover, and covering it straight is an advantage,
because the incumbent titles are too close to their advertisers to do it well.
That is reporting on the industry, not adjudicating a foreign policy.
