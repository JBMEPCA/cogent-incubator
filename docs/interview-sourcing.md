# Keeping the interview queue full

JB, 23 Sep 2026: about 30 approaches per title per month, across all ten titles.
At our rates (14% reply, 8% published across 113 approaches) that is roughly 4
replies and 2 to 3 published interviews per title per month.

The sending, chasing, drafting and the "you are live" email are already
automatic. The only part that runs dry is **candidates**, which is what this
document is about. On 23 Sep every title had an empty queue and the sweep had
had nothing to send for two weeks.

## The weekly rhythm

| When | What | How |
|---|---|---|
| Monday | Source 8 candidates per title | ten research agents, one per title, then curate |
| Monday | Queue them | `send-interview-batch.mjs --queue` |
| Weekdays | Send 3 per title per day | `drip-interview-outreach.mjs --send` |
| Hourly | Replies, chases, drafts | the sweep on Vercel, already live |

Eight per title per week is about 32 a month, which is the target with a little
headroom for the ones that turn out to be unreachable.

## Sourcing run

1. `node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/outreach-prepare.mjs --out=<dir>`
   writes `titles.json` (every title with its audience and series name) and
   `already-contacted.txt` (every company any title has written to).
2. Ten research agents in parallel, one per title, each writing
   `<dir>/<slug>.json`. Give every agent: research only, never send, never touch
   the database; the two briefing files; the title's audience; what makes a good
   candidate; and the rule that an address is recorded only if it was actually
   seen on the company's own site.
3. Curate by hand. Drop anyone with no published address, anyone who trades
   under a first name only, general council inboxes, addresses lifted from a
   privacy notice, and anyone outside the title's audience.
4. Tidy: company names go in the subject line, so strip "Ltd" and parentheses,
   and cut news hooks longer than two sentences, because the hook is the second
   paragraph of the mail and six sentences reads like a dossier.
5. Queue: `send-interview-batch.mjs --dir=<dir> --queue`.

## What actually gets replies

Nearly every reply we have ever had came from an awards hook: Pet Remedy's
King's Award, Novo Cabelo at the Modern Barber Awards, Brenda Sunley's
Everywoman award, Bethell's Rising Star. Shortlists are public, dated and full
of named operators, so the best single source is each sector's awards calendar,
worked the week the shortlist lands.

Generic inboxes work. Of 113 approaches, 81 went to a general info@ or hello@
and produced 8 of the 16 replies, which is why the mail opens by asking whoever
reads it to pass it to the named person.

## What does not work

- **The 2026 roster harvest** (`scripts/roster/`). Fleet's was OEM sales and
  leasing staff, golf's was greenkeepers and turf machinery, barbering's was
  stale US brand-side contacts, Smart SME's was one awards list repeated with no
  addresses. All 54 candidates in the first batch were sourced fresh instead.
- **Pre-asks.** Thirty one in August produced nothing. Questions go up front.
- **Form-only companies.** About one in ten good candidates publish no address
  at all. They need a phone call, so they go on a list for Lucas rather than
  being guessed at.

## Traps

- A dry run of the batch sender used to seed the queue, and the duplicate guard
  then read its own seeds as contacts and skipped all 48 candidates. Fixed, but
  it is the shape of mistake to watch for: the guard counts only rows with
  `askedAt` set.
- The subject line is built from the row, not the pack, so fix a company name
  before the row is created, not after.
- A title with no `interview_franchise` setting falls back to "SME Leaders". The
  batch sender and the drip both refuse to send for such a title.
- Each research agent hits the 200 web search cap, which is why they lean on
  awards lists. Raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` for a bigger
  run.
