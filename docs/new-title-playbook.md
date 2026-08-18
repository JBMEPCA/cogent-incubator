# Launching a title: the playbook

Written after title #2, The Fleet Magazine, on 17 August 2026 — the first time
the multi-title engine was actually used to launch a title rather than to
describe one. Roughly six hours end to end, of which perhaps ninety minutes was
the work and the rest was discovering traps.

The point of this document is that title #3 should take ninety minutes.

Updated 17 August 2026: both titles now run on the shared cogent-base parent
theme, deploy over SFTP and pass scripts/verify-title.mjs. Title #3 starts by
copying an existing child, not by forking a theme.

---

## THE RULE

**Anything shared belongs to every title. Before changing shared code, ask what
it does on the OTHER titles — not whether it looks right on the one in front of
you.**

This failed four times, in four costumes, and it is the same mistake each time.
The first three were found in a single day; the fourth had been live on three
sites for weeks, because it looked perfect on the title it came from:

| What was changed | What it did to the other title |
|---|---|
| Agent prompts naming one title | Fleet articles drafted for SME owner-managers, and large-operator stories struck out |
| The tools list in the parent theme | Smart SME would have lost all four of its calculators |
| `.logo-mark` pointing at the `amber` palette slug | Smart SME's masthead turned orange on a live site |
| The parent theme keeping the copy of the title it was forked from | Smart SME and Golf Resort Magazine spent weeks branded as The Fleet Magazine, and their subscribers were filed into Smart SME's Mailchimp audience |

Concretely:

- **The parent theme may only reference palette slots whose meaning is identical
  everywhere** — `brand`, `contrast`, `surface`, `line`, `muted`. Never `amber`,
  `cyan`, `violet`: those are expressive, and every title fills them differently.
  Anything expressive is a one-declaration override in the child.
- **A prompt may name no title.** Identity comes from the Site row via
  `lib/voice.js`, and a list of valid sections or categories comes from
  `site.sections`.
- **The parent theme may not name a publication, in copy or in config.** Not a
  heading, not a newsletter promise, not a `From:` address, not a Mailchimp
  audience. It asks `cogent_brand()` who this site is. Copy is code: a sentence
  in a shared theme is a single-title assumption exactly as much as a hardcoded
  category list, and it survives longer because it renders without complaint.
- **Editorial choices live in the child or the database**, never in the parent:
  which calculators exist, which sections the homepage shows, what the masthead
  says.
- **After deploying anything shared, sweep every title**, not just the one you
  were working on: `node scripts/check-all-titles.mjs`, and from
  `cogent-base-theme`, `node scripts/check-title-agnostic.mjs --all`.

The parent/child split is better architecture, and it converts "I broke one
site" into "I broke every site". That is the trade being made, and this rule is
the price of it.

---

**§§1-6 are about standing a title up. §§7-8 are about the engine behind it, and
were written the same day from the other direction** — Smart SME spent a weekend
publishing a full schedule perfectly while its drafting pipeline was dead, and
nobody noticed because everything that gets looked at said "fine". A new title
inherits that engine, and inherits gates calibrated on a mature site's output, so
read them before launch rather than after.

---

## 1. What actually went wrong, in order of how much time it cost

Ranked honestly. The big ones were not the ones anyone would have predicted.

| # | What happened | Cost | Now |
|---|---|---|---|
| 1 | **Agent prompts still named Smart SME.** The rebuild tenanted the *data* and not the *voice*. The Researcher and Director told agents to strike out "content aimed at large corporates", which on a fleet title rejects exactly the operators the business case was built on. The batch publisher's drafting prompt opened "You write for Smart SME Magazine". | ~2h | **Fixed in code** |
| 2 | **Scripts lagged the app.** `batch-publish.js` and `seed-news-searches.mjs` both predated multi-tenancy: env-var credentials, `prBrand` rows with no `siteId`. Neither would have run; one would have cross-published had the env vars still existed. | ~1h | **Fixed in code** |
| 3 | **Local commits are not production.** The engine was switched on and ran against `origin/main`, which did not have any of the above. Everything looked fixed and nothing was. | ~40m | **Habit, not code** |
| 4 | **DNS and SSL are a serial wait.** SSL cannot issue until DNS fully propagates; the WordPress credential cannot pass until SSL exists; nothing downstream can start until that credential passes. | ~1h idle | **Unavoidable — start it first** |
| 5 | **Gates calibrated for a mature site block a new one.** The link gate demanded four internal links on a site with zero posts, so it held every article forever. | ~30m | **Fixed in code** |
| 6 | **An uncapped batch hit the account API limit and took *both* titles down.** `ANTHROPIC_API_KEY` is fleet-wide. | ~30m | **Set caps first** |

---

## 2. The order that works

Each step blocks the next. Doing them out of order is where the hours went.

**Start the clock on DNS before anything else.** It is the only step with a
mandatory wait, and everything hangs off it.

1. **Register the domain**, both `.co.uk` and `.uk`. Check availability at
   Nominet RDAP before falling in love with a name. If the exact match is taken
   by a parked registration less than a year old, enquire — it is usually cheap.
2. **Create the site at the host**, then point nameservers. Never the reverse:
   flipping nameservers before the host has a DNS zone takes the domain dark.
3. **Now go and do something else for an hour.** DNS propagates, then the host
   issues Let's Encrypt. Neither can be hurried. Use the wait for steps 4-6.
4. **Google Workspace: add the domain as a SECONDARY domain to the existing org.**
   Never a new Workspace. The existing domain-wide delegation then covers the new
   mailbox with zero Google Cloud work; a new org means setting all of it up again.
5. **Create the intake user** (`news@…`) and generate DKIM.
6. **Write the content plan and the source list** while you wait.

   **A Google News query is not a source.** It yields a headline and a redirect
   stub: the link is a JavaScript shell with no publisher URL in it, so the
   fetch returns the literal string "Google News" — two words — and the RSS
   summary beside it has a median of 13 words. Fleet launched on twelve such
   queries and nothing else, and every news rewrite it produced scored 42 to 71
   with the same complaint: "thin source with no figures limits depth".

   Direct feeds return about 1,600 words of real article. Aim for **30+ direct
   feeds before launch**. Autodiscovery from each brand's newsroom page finds
   roughly a fifth of them; the rest are `/feed/`, `/rss.xml`, `.atom` on
   gov.uk, or a `media.`/`press.` subdomain. Trade bodies and regulators are the
   richest and the easiest — gov.uk organisation pages all expose `.atom`.
7. **Install WordPress, Yoast and Site Kit, then the theme.** Yoast *before* the
   first publish — see §3.

   **The theme is a CHILD of `cogent-base`, never a fork.** Copy an existing
   child (`fleet-magazine-website/child` is the reference), which is about
   fourteen files: `style.css` with `Template: cogent-base`, `theme.json`,
   `functions.php`, the masthead parts, `templates/home.html` and the section
   patterns. Then, in order:
   - Deploy the parent first if this host has never had it.
   - List **every** palette colour and font family in the child's theme.json,
     and ship any font file the child declares (see §3).
   - Pick the title's calculators in `functions.php` via the `cogent_tools`
     filter — the default is none, deliberately.
   - Point templates at `cogent-base/…` for shared patterns and
     `<title-slug>/…` for the section patterns.
   - After activating, run `wp option update template cogent-base` (see §3).
   - **Tools are shortcodes on ordinary pages.** Create `/tools/` with
     `[cogent_tools_index]` and a page per calculator, or the tool exists in
     code and 404s on the site — which is exactly what happened to title #2.
8. **Create two WordPress users**: the `Engine` at **editor** role with an
   application password, and the byline account at author role.
9. **Store credentials in the app** and let the probe pass.
10. **Set the daily spend cap**, then enable the engine.

---

## 3. The traps that will happen again every single time

These are environmental. No amount of code fixes them; they need to be on a
checklist.

### WordPress silently discards unregistered meta keys
The engine writes `_yoast_wpseo_metadesc` and `_yoast_wpseo_focuskw` on every
publish. If Yoast is not installed, WordPress accepts the request, returns 200,
and **throws the meta away without error**. Every article published before Yoast
went on had no meta description and no social tags.

Recoverable only because the app's own `Article` table keeps `metaDesc` and
`keyphrase`, so they can be pushed back afterwards. **Install Yoast before the
first publish.**

### `/wp/v2/users` hides users who have never published
For a role without `list_users` — which the Engine deliberately is — the users
collection is silently narrowed to users with published posts. A freshly created
byline account is invisible, so `?search=James Burke` returns an empty array
while the user plainly exists. Use `?who=authors`.

### The host's default MX and SPF must be replaced, not added to
SiteGround creates `mx*.antispam.mailspamprotection.com` MX records and its own
SPF on every new site. Google's setup replaces the MX, but the SPF has to be
**edited by hand** to add `include:_spf.google.com`. Adding a second `v=spf1`
record is a permanent error that breaks SPF entirely.

### The host caches hard enough to fake a bug
After changing anything that renders into `<head>`, verify with a cache-busting
query string. Meta descriptions were correct and invisible for several minutes,
which reads exactly like a broken write.

### "Protected URLs" is not "captcha exemption"
The provisioning step used to read *"exempt the REST API from the captcha"*,
which sent the reader to the host's Protected URLs tool — that adds HTTP Basic
Auth to a path, and applying it to `/wp-json/` would have walled off the only
interface the engine publishes through. The step now reads *verify*, not
*exempt*, because the captcha usually is not firing at all.

### Installing the certificate is not the same as enforcing HTTPS
The site answered on `http://` with a 200 rather than redirecting, so the browser
showed "Not secure" on a page with a perfectly valid certificate. Turning
**HTTPS Enforce** on in the host's SSL Manager is a separate action from
installing the certificate, and nothing warns you.

### An empty navigation block auto-lists your pages
A block theme's `wp:navigation` with no inner links quietly renders whatever
pages exist, which is how "Sample Page" ended up in the masthead. Define the
menu explicitly in `parts/header.html`.

### `/wp/v2/users/me` omits roles without `context=edit`
Cost a false failure in the smoke test itself. The role check needs
`?context=edit`, and an editor is allowed it for their own record even though
they are refused it for the users collection.

### sftp batch files eat Windows backslashes
A local path in an `sftp -b` batch file must use forward slashes: the parser
treats a backslash as an escape, so a Windows path arrives with every separator
swallowed and each upload fails on a filename that does not exist. Make
directories with `ssh mkdir -p` rather than sftp's `-mkdir`, which prints a
Failure line for every directory that already exists and buries the real error.

### Renaming a function prefix silently breaks published content
Shortcodes are content, not code. When the theme prefix changed, Smart SME's
live tool pages still contained `[smartsme_tool …]`, and WordPress renders an
unregistered shortcode as **literal text** — a page that had served traffic for
weeks would have quietly become visible shortcode syntax with no error anywhere.
Register the old names as aliases, and remember the asset-loading check tests
for shortcodes by name too, or the tool renders with no CSS and no JavaScript.

### A tool existing in code does not put it on the site
Tools are shortcodes on ordinary WordPress pages. Title #2 shipped the company
car tax calculator in its theme for a full day while `/tools/` returned 404,
because nobody had created the pages. Check the URL, not the registry.

### The byline user's SLUG is load-bearing, and it is hardcoded in the parent
`cogent-base/inc/author.php` forces the author of every post through a
`wp_insert_post_data` filter:

```php
const COGENT_AUTHOR_SLUG = 'james-burke';
$user = get_user_by( 'slug', COGENT_AUTHOR_SLUG );
$id   = $user ? (int) $user->ID : 1;   // <- silent fallback to the admin
```

Title #3 created its byline account as `jamesburke`, so the slug was
`jamesburke`, the lookup missed, and **every article published under the
administrator account**. Nothing errored. `wp post update --post_author=3`
reported `Success:` and changed nothing, because the same filter reassigned it
on the way back into the database, which reads exactly like a broken wp-cli.

Two things follow. When creating the byline user, set the nicename explicitly:

```bash
wp user create jamesburke news@<domain> --role=author --display_name="James Burke"
wp user update <id> --user_nicename=james-burke
```

And check the rendered byline on a live post before running a batch, not the
value you passed in. Existing posts are fixed by correcting the slug and then
re-saving them, at which point the filter does the right thing by itself.

The deeper problem is that a fleet-wide constant names one person. When a title
needs a different byline this has to become a filter the child can answer, the
same shape as `cogent_mark_colour`.

### A theme's parent is stored in the DATABASE, not read from style.css
Converting a standalone theme into a child by adding `Template: cogent-base` to
its style.css does nothing on its own. WordPress keeps `template` in wp_options
from the moment the theme was activated, so it carried on looking for the parent
inside the child's own directory: every pattern that called a parent function
fatalled, and the site served a 500 with all the files correct on disk.

Fix with `wp option update template <parent>` over SSH, or by re-activating the
theme in wp-admin. **wp-cli is available on SiteGround** and is much the faster
route — it also flushes the cache and lists the parent/child relationship back
to you so you can see it took.

### theme.json preset arrays are REPLACED by the child, not merged
A child declaring two font families silently drops the parent's other two, and
the same goes for the colour palette. List **every** palette colour and **every**
font family in the child, including the unchanged ones. Keep a copy of any font
file the child declares, too: `file:./assets/fonts/…` resolves against the theme
that declares it, never the parent.

### Git Bash rewrites Unix absolute paths in arguments
`--to=/home/u18-…/themes/x` reached the script as
`C:/Program Files/Git/home/u18-…/themes/x`, and the first parent deploy built
that entire tree inside the server's home directory. Prefix the command with
`MSYS_NO_PATHCONV=1`. `deploy-theme.mjs` now refuses a path that looks mangled
rather than uploading 41 files somewhere absurd.

### The GA4 property ID in the URL is the wrong one
On the property-create screen the ID in the address bar is the *previously
selected* property. Storing it silently reports the wrong title's traffic.
Verify by name through the Admin API `accountSummaries` endpoint.

### The host blocks datacentre IPs, so we cannot read our own images back
An image served from our own WordPress answers every request from a laptop and
returns **403 to Vercel**. Verified on 17 August: four different user agents all
got 200 locally, the publisher got 403 on the same URL. It is the source IP, not
the user agent.

The consequence is not obvious. Any image placed in the media library by hand —
a commissioned graphic, an original illustration, anything not sideloaded from a
stock library — could not be fetched back by the publisher that was about to
re-upload it. The picture gate failed it on `image fetch 403`, `publish-due`
dropped the image and deferred the article to the Designer, the Designer did
nothing because the article already had a picture, and the piece sat there for
ever. On an image that was in the library the whole time.

Fixed with `findMediaByUrl()`: if the image URL is on the title's own host,
look the attachment up and attach that id directly — no fetch, no re-upload, no
second visual check. Safe precisely because it is ours. **It also has to write
the alt text**, because `uploadMedia` is where alt normally gets set and that
path skips it; the first article through published with an empty `alt`.

### Vercel "Sensitive" environment variables cannot be read back — ever
Not by `vercel env pull`, not in the dashboard. The pull returns
`DATABASE_URL="[SENSITIVE]"`, a literal placeholder. On 17 August all 19 of this
project's own secrets were Sensitive; the only readable values were Vercel's own
build vars (`TURBO_*`, `VERCEL_*`).

So **Vercel is never the place to recover a connection string.** Go to the owner
of the thing: Neon for the database, Google Cloud for the service account. Wasted
half an hour sending someone to a dashboard that structurally cannot show it.

### Vercel's git hook does not always fire
A push landed on `origin/main` and no deployment was created — confirmed with
`git ls-remote` showing the commit on the remote while the newest deployment was
older than the push. Silent: no error, no queued build.

**Always check the deployment age against your commit, never assume the push
deployed.** `vercel --prod --yes` from a clean working tree forces it. This
matters more than it sounds: everything downstream was verified against code
that was not running.

### The play button runs Windows PowerShell 5.1, which rejects `&&`
Two separate instructions failed on this before anyone noticed, because the
failure is a parser error before execution and looks like nothing happened at
all — including an `npm i -g` that appeared to have run and had not. PowerShell
5.1 needs `;` with `if ($?)`. Any command written for someone to click must be
PowerShell, not bash.

---

## 4. Pre-flight checklist for title #3

Run these before touching a console.

```
□  git rev-list --count origin/main..HEAD   → must be 0, or deploy first
□  vercel ls → newest Production deploy is NEWER than your last commit
      → the git hook does not always fire; pushed is not deployed
□  grep -rniE "<previous title name>" lib/ scripts/ --include=*.js
      → every hit is a tenancy bug waiting to happen
□  cd cogent-base-theme && node scripts/check-title-agnostic.mjs --all
      → the same sweep for the themes, which the grep above never reaches.
        Add the new title to TITLES in that file FIRST, or it is not checked
□  New child theme declares its own cogent_brand filter
      → name, audience, newsletter copy, contact_email, mailchimp_audience.
        The defaults are derived and safe, but "safe" is not the same as "right"
□  A Mailchimp audience exists whose name matches the title's
      mailchimp_audience exactly
      → no match means signups queue locally forever, visible only on
        Settings → <title> in wp-admin
□  grep -rn "SLOTS_PER_DAY\|= 7\b" scripts/ lib/
      → anything measuring against a fixed cadence is already wrong
□  Local .env DATABASE_URL names the CURRENT Neon project
      → after any migration the old repo's scripts lie confidently
□  Anthropic credit balance is not near zero (it is fleet-wide)
□  Daily spend cap set on the new title AND every existing title
□  Search set added to lib/news-searches.js and to SEARCH_SETS
□  Source list written (see scripts/seed-fleet-sources.mjs for the shape)
□  At least 30 sources have a real feedUrl, not just Google News queries
      → a title whose wire is 100% Google News cannot write news worth reading
□  Content plan written (scripts/batch-plan-<slug>.json)
□  Sections chosen; they must match the plan's `category` values exactly
□  articlesPerDayTarget set (1-7; it clamps silently above 7)
```

And after launch:

```
□  node scripts/verify-title.mjs --site=<slug>     → must be all PASS
□  HTTPS Enforce on at the host (a valid cert alone is not enough)
□  Sample Page deleted, menu defined explicitly, favicon rendering
```

Then on each of the first few days, because a full schedule proves nothing (§7):

```
□  node scripts/day-report.js --site=<slug>
      → published vs the title's OWN target, and spend > £0
      → spend of £0 with articles publishing means it is draining a backlog
□  Editor and Researcher have both run TODAY
□  "ready but unscheduled" is not 0 for days on end — no buffer means one
      QA rejection costs a slot
□  First article's featured image has alt text on the live page
```

`verify-title.mjs` exists because every one of its eighteen checks is something
that failed silently during title #2 and was only caught by accident. It covers
the engine switches, the spend cap, every credential, the REST captcha, the
editor role, the byline, section-to-category matching, the meta description on a
cache-busted live page, the wire, and any blocking provisioning. Run it before
declaring a title live, and again after any change to the engine.

---

## 5. What breaks at 25 titles, and what to build

Today was survivable at n=2. Most of it does not survive n=25.

| Problem | Why it breaks | What to build |
|---|---|---|
| ~~Theme changes need a manual zip upload~~ | The Engine is an editor and cannot install themes, so every CSS tweak was a zip through wp-admin. | **Built:** `sftp` credential kind + `scripts/deploy-theme.mjs`. Key based, no password stored. |
| **~14 manual console steps per title** | Domain, DNS, WordPress, users, Workspace, GA4, Search Console. Roughly 90 minutes of clicking that cannot be scripted away entirely — but most of it can. | Provisioning automation where APIs exist: Cloudflare/registrar API for DNS, WP-CLI or a scripted install, GA4 Admin API for property creation. |
| **Google Workspace licence per title** | Not in the cost model at all. At £5-14/user/month, 25 titles is £150-420/month — more than the entire engine. | Decide the mailbox strategy now: shared catch-all vs per-title user. This is a real cost decision, not a detail. |
| **Content plan written by hand** | Ten briefs took a considerable amount of careful writing, and they are the difference between useful articles and filler. | A brief-generating step that takes a demand map and produces the plan. The research is already how we choose the vertical. |
| **Source list written by hand** | 72 sources for fleet. At 25 titles that is 1,800 hand-picked URLs. | Generate from the vertical's advertiser map, which the business case produces anyway. |
| ~~No launch smoke test~~ | Was done by hand, ad hoc, and several failures were missed until they bit. | **Built:** `scripts/verify-title.mjs`, 18 checks. |

---

## 6. Costs, measured

From the first fleet batch: 10 articles attempted, 8 published, **$4.11**.

| | Calls | Cost |
|---|---|---|
| Clean article | 5 | $0.26 |
| Article needing one revision | 7 | $0.55 |
| Article held on the picture gate | 12 | $0.80, nothing published |

**Opus was 99% of spend.** Measured independently across 1-17 August on Smart
SME: 438 costed runs, £32.15, of which **£32.09 was Opus**. Haiku had touched
only the Director and the meta-description call. Nothing was wrong with the
choice — it had simply never been *made*. Opus was the default and the default
was never revisited as the engine grew.

Correction to an earlier draft of this section: it claimed the picture gate had
moved to Haiku across the codebase. **It has not, and deliberately so.**
`lib/images.js` routes *query writing and candidate picking* to Haiku; the gate
in `lib/qa.js` that looks at actual pixels stays on Opus, and `images.js` says
why in a comment. That gate earns it — on 17 August it rejected three stock
images in a row and was right every time, including catching a **ChatGPT
interface about to be published on an article about Anthropic**.

### The routing now in place, and the principle behind it

| Call | Model | Why |
|---|---|---|
| `draftArticle` | **Opus** | the draft IS the product; nothing to save |
| `reviewArticle` (editorial gate) | **Opus** | cheapening the check that catches bad work means publishing bad work and paying twice |
| `verifyImage` (picture gate) | **Opus** | reads real pixels; the last thing between a wrong logo and a live page |
| `repairArticle` | Sonnet | fixing a draft against a fault list someone else wrote is copy-editing, not composition |
| SEO sweep | Sonnet | matches posts against written rules; every suggestion waits for approval |
| Outreach emails | Sonnet | fixed template, queued for approval before sending |
| Researcher | Sonnet | returns a scored shortlist of headlines; nothing it writes is published |
| Director, Finance | Haiku | triage and sequencing |
| Image query / pick | Haiku | routing, not judgement |

**The principle: pay the writing rate for writing.** Everything else either has
its output checked by a human before it reaches anybody, or produces something no
reader ever sees. That covered ~£12 of the £32 fortnight at roughly 40% less,
with nothing a reader sees touched.

Drafting on Sonnet is still not taken, for the reason already given: the first
titles publish tax and compliance content where being wrong is expensive.

### Where the money actually leaks

Measured over the same window, and the answer was not what it looked like from a
single bad day:

| Category | Cost | Share |
|---|---|---|
| Repair passes (attempt 2+) | £5.51 | 17% |
| ↳ of which "fixed but *still* held" | £3.24 | 10% |
| Work on articles that never published | £4.96 | 15% |
| Succeeded but produced nothing usable | £2.77 | 9% |
| Failed with an error | £0.88 | 3% |

Those overlap — a repair pass on an article that never published is in two rows —
so they do not sum. Netted out, **~15-20% went on work that never reached the
site.** Real, worth fixing, and still smaller than the model-choice lever. Do the
routing first.

Two things that are *not* waste and should not be optimised away: the Director's
heartbeat ticks (pennies, on Haiku, and that is what a pulse costs), and the
editorial gate refusing an unsourced claim. Refusing to publish something wrong
about a named company is the cheapest money in the day.

---

## 7. When the engine is lying to you

Every one of these was found on 17 August, on a title that from the outside was
publishing perfectly.

### Publishing and drafting are independent, so a dead engine still publishes
The weekend of 15-16 August published **7 of 7 on Saturday and 7 of 7 on Sunday**,
every post within six minutes of its slot, ~11,000 words a day. It looked
flawless. Behind it the Editor had run **once since Friday**, the Researcher
once, the Designer, LinkedIn and Backlink not at all. The Director ran 26 times a
day reporting "Team on track, nothing to arbitrate".

It was draining a backlog drafted before the cutover. The backlog ran out on the
Monday morning and the site went from perfect to nothing in one slot.

**A full schedule is not evidence of a working engine.** The signal that
mattered was spend: **$0.00 across two days**. Zero cost with articles publishing
means the articles were written earlier. Check the pipeline behind the schedule —
`ready but unscheduled`, `drafting`, and Editor runs — not the publish count.

### Credit exhaustion looks exactly like a quiet engine
`400 Your credit balance is too low` fails the model call, the agent records a
failed run, and nothing publishes. There is no alert. It presents as agents that
"aren't doing anything".

`scripts/resume-when-funded.sh` exists for this: it probes with a one-token
request every two minutes and resumes when the balance returns. Rejected probes
are not charged, so polling is free. Somebody wrote it after a batch died the
same way, which is the point — **this will happen again.**

### Local tooling silently reads the pre-migration database
After Smart SME moved into the fleet app, `smart-sme-app/.env` still named the old
Neon project. Every table on it stopped at **Friday 14 August 13:35**, a clean cut
across `Article`, `AgentRun`, `AgentMessage`, `ResearchTopic` — the signature of
a changeover, not a fault. `day-report.js` run from the old repo therefore reported
a **total weekend outage that had not happened**, while the site published 21
articles.

Two lessons. **After any migration, the old repo's scripts are legacy and will
lie confidently** — check which endpoint they name before trusting a number. And
a clean cut at one instant across every table means the database moved; a
degrading connection looks nothing like that.

Neon makes this visible: the projects list shows *Compute last active*. Careful
though — reading the frozen project with a script wakes its compute, so "active 7
minutes ago" may be your own query rather than production.

### Anything that reports a target must read it from settings
`day-report.js` measured output against a hardcoded 7 mirroring `SLOTS.length`,
and ran every query unscoped across the fleet. With two titles on different
cadences it reported **"12 of 3"** — both titles' output against one title's
target.

The cadence changes constantly. Smart SME ran at 7, then 1, then 3 inside a
week; Fleet Magazine went from 1 to 5 in an afternoon. **Never hardcode it, never
cache it, and scope every query to a `siteId`.** One report per title; a fleet
total tells you nothing about either title.

Related limitation, worth knowing before it misleads you: `articlesPerDayTarget`
stores only the **current** value. A past day is necessarily scored against
today's number, so 16 August reads "7 of 3" and looks like a collapse in output
rather than a setting that moved. The report says so out loud. Fixing it properly
means historising the target, which is a schema change nobody has needed yet.

### The daily target is capped at 7 and clamps silently
`SLOTS` has seven fixed times; `slotsFor()` and the settings form both clamp to
it. Set 10 and you get 7, with no warning. More than seven a day needs slot times
added to `lib/schedule.js` first.

### Do not "even out" the slot distribution without reading WEEK_PLAN
At 3/day `slotsFor()` picks slot indices 0, 2, 4 — 07:30, 10:30, 13:30 — which
looks badly front-loaded, with the whole afternoon empty. It is not a bug:
**10:30 and 13:30 are the `seo_original` slots every day**, so the formula is
deliberately capturing both ranking slots. An "even spread" of 0, 3, 6 produces
**three news pieces and no guide at all on a Tuesday.**

There is a genuine trade-off here between time-of-day spread and protecting the
ranking slots, and it is an editorial decision. It is not a tidy-up.

---

## 8. Calibrating the gates

§1 noted that gates tuned for a mature site block a new one. That is broader than
the link threshold, and it bites every new title.

### The editorial gate will call genuinely new things fabricated
The gate is a model with a training cutoff, asked to judge whether claims are
invented. On a news publication, **unfamiliar is the normal condition of a fresh
story.** On 17 August it demanded someone "verify" a real Anthropic announcement
URL that the brief had supplied, and called two real products fabricated.

This is worst on exactly the stories worth most: the newest ones, which are the
ones with link and traffic potential.

Three changes, all of which any new title needs from day one:

1. **Tell it plainly that it cannot rule on existence.** The test is "nothing
   here backs this up", never "I have not heard of this". Asking for a URL to be
   verified is not an actionable objection, because it cannot check one.
2. **Pass the commissioning brief to the gate, not only to the writer.** The
   brief is where "checked against a primary source" is recorded. It also lets
   the gate catch the *real* version of the fault — and it immediately did,
   correctly rejecting a table of invented subscription prices the Editor had
   added beyond the brief.
3. **Source-check at commissioning, not after drafting.** Every expensive dead
   article was a news claim with no `sourceUrl`. A Haiku call confirming a source
   exists costs a fraction of a penny; an Opus draft plus two repairs costs ~£0.55.

Result on one article: **42 → 88, "fix" → "publish", zero issues.**

### A hold with no stated reason must never stick
`{"verdict":"fix","summary":"","issues":[]}` gave `repairArticle` nothing to act
on, so it threw — `nothing to repair: no recorded QA issues`, **61 occurrences
and the single most common failure in the database.** The article stayed held, the
gate ran again at full rate, and three rounds later a finished article was parked
without one word ever having been said against it.

Now the score decides: 70+ publishes, below that the score itself becomes the
stated reason so the next pass has something real and the queue shows what
happened. **Any gate that can withhold approval must be unable to do so silently.**

### Retry counters must count the current cycle, not the article's lifetime
Counting every Editor run ever meant a parked article could never come back:
recommission it with a proper brief and a verified source and it is abandoned on
the first tick, because the counter still holds the three failures from the
original attempt. Anything once parked was permanently unpublishable. Count from
the most recent draft; old runs stay on the record for costing and stop voting.

### Adaptive thinking spends from `max_tokens`, and three call sites learned it separately
The verdict is written *after* the thinking, so a tight ceiling means the model
reasons through its whole allowance and returns no text. The QA gate at 900
tokens returned score 0 and an empty verdict once the brief was added — which the
new unreasoned-hold path then read as "held without stating a fault", sending the
repair pass to rewrite prose that was never the problem.

`draftArticle` (16000), the SEO sweep (20000+) and now the gate (4000) each
arrived at this independently. **The reply is a few hundred tokens; headroom is
free on a call that finishes early.** Also: a reply with no verdict at all is a
broken gate, not a bad article, and must be raised as an error — never reported as
an article fault.

### Do not pay to write what cannot be written

The gate catching a bad article is the expensive way to find out. On 18 August
Smart SME spent £1.53 of Editor time to publish one article out of three: two
pieces each took three full passes against a single objection and were then
parked. Three changes, all fleet-wide, all in `lib/drafting.js` and
`lib/agents/team.js` so every title inherits them with no configuration:

**A pre-draft material gate.** Before the Opus call, count what is actually
available. Under `MIN_SOURCE_WORDS` (50) of fetched source AND under
`MIN_SUMMARY_WORDS` (25) of feed summary, with no commissioning brief, the piece
is parked for nothing rather than drafted for ~£0.20 and then repaired twice.
The thresholds are a floor in code, not a model call, because the gap between a
direct feed and a Google News stub is 1,600 words against two.

Park, never throw. A throw leaves the article in `drafting`, the Editor takes
the oldest `drafting` piece every tick, and the whole queue stalls behind it.

**The repair pass may correct the headline and meta description.** It used to
write only the body and hand the ORIGINAL title back to the gate, so any
objection naming the headline was unfixable by construction — it survived every
rewrite, failed three times and parked the article. That binned an 80-scoring
evergreen guide whose only fault was a headline contradicting its own text.

**A repair that changes nothing parks immediately.** When the gate returns
exactly the issues it raised before, the pass has failed to move it and another
round buys the same answer at full price.

The general rule, and it is the one to carry into a new title: **every gate
needs a matching power to fix what it objects to, and every objection it raises
must be actionable by whatever runs next.** Three separate bugs this week were
the same shape — a gate raising something the repair path had no way to act on,
and a loop paying full rate until a counter killed it.

### A prompt is not a guard
`repairArticle` asked for "the corrected body as HTML and nothing else" and
trusted the reply. That held for as long as the call was on Opus. Moved to
Sonnet, it returned the whole `TITLE / SCORE / IMAGE_QUERY / KEYPHRASE /
META_DESC` header above the article, and the block was stored as the body — so
internal field names became the opening words of the piece.

It failed twice over: the article would have published with a wall of metadata at
the top, **and** it then failed a mechanical test it genuinely passed, because the
header displaced the real first paragraph out of the first 700 characters, which
is the window the keyphrase check reads.

`draftArticle` had guarded this from the start with two lines. The repair path
never did, and the model was standing in for the guard. **Every model reply that
gets stored needs the same parsing on every path** — changing the model is enough
to expose the difference.

---

## 9. The one-line version

**Everything that broke was something that had only ever been true for one
title.** Prompt strings, credentials, gates, thresholds, scripts, user-agents,
link classifiers. The rebuild made the *database* multi-tenant and left the
*assumptions* single-tenant, and each one surfaced only when a second title
actually ran through it.

For title #3, the useful question is not "what do I need to set up" but **"what
in this codebase still believes there is only one title?"**

And its twin, from §§7-8: **everything that hid was something whose failure looked
like success.** A full schedule draining a dead pipeline. A gate holding an
article without saying why. A report measuring against a cadence nobody was
aiming at. A push that never deployed. A frozen database answering queries
confidently. None of them threw an error, and every dashboard said fine.

So the second question is **"if this were broken, how would I know?"** Where the
answer is "the number I look at would still look right", that is the thing to
instrument. Spend was the tell all weekend: £0.00 with articles going out. Nobody
was looking at it.

---

## 10. Post-deploy: purge the cache, then look at it on a phone

Added after both homepages were reported dead while every automated check said
the sites were healthy. Two separate failures, one visible symptom.

**The host cache serves the old page.** `deploy-theme.mjs` prints "purge the
host cache" and that is not a suggestion. After the parent/child split both
homepages served a pre-swap page that referenced a stylesheet with zero rules in
it: HTTP 200, correct HTML length, no PHP error, and a ticker 989px tall
swallowing the screen. `wp sg purge` over SSH, on every title, every time.

**Status codes do not detect a dead layout.** `verify-title.mjs` passed 19/19
against a homepage nobody could read. `check-pages.mjs` now sweeps every page,
category, article and the 404 with a cache-busting request and a mobile user
agent, and fails a page whose HTML does not reference the parent stylesheet —
which is the specific shape this failure takes.

Neither replaces opening the site on a phone. Do that after any theme change.

### A shared parent must not point at a semantic palette slug
The masthead chip and the favicon in `cogent-base` both used the `amber` slug,
because The Fleet Magazine wanted an amber mark. Amber is a slot **every** title
fills, so Smart SME rendered its own `#D97706` and its masthead turned orange —
a live title wearing another title's colour, introduced by a change that had
nothing to do with it.

Rule: **the parent may only reference slots whose meaning is the same for every
title** — `brand`, `contrast`, `surface`, `line`, `muted`. Anything expressive
belongs in the child, as an override of one declaration. This is the third time
the same mistake appeared in a day, in three different forms: prompts naming one
title, a tools list holding one title's editorial choice, and now CSS pointing
at one title's accent. **When touching anything shared, ask what it does on the
OTHER title, not whether it looks right on this one.**

### The category list in the draft prompt was another single-title assumption
Ten fleet articles were told to file themselves under
`AI & Automation | Finance | Marketing | News | Operations` — Smart SME's
sections, hardcoded in the batch publisher's output contract. They came back as
Finance and Operations, matched no category on the fleet site, and all ten
landed in Uncategorized. Every category archive was empty and the homepage
sections never rendered, which looked exactly like "not enough content yet".

The prompt now lists the site's own sections, and the commissioning plan's
category wins over the model's guess, validated against the section list.
**When a title publishes its first articles, check the category counts, not just
that the posts exist.**

### The parent theme was carrying the copy of the title it was forked from
Found on 18 August, live on three sites at once, and the longest-lived of every
single-title assumption in this document — because it shipped in the commit that
was supposed to end them.

`cogent-base` was created by copying The Fleet Magazine's theme and running a
find-and-replace over the name. The replace caught the identifiers and missed
every sentence. What the other two titles then served their readers:

| Where | What Smart SME and Golf Resort Magazine actually said |
|---|---|
| Homepage H2 | "Fresh from The Fleet Magazine" |
| Homepage CTA band | "The best of The Fleet Magazine in your inbox: tax changes, the EV transition and running costs for UK fleets" |
| Sidebar MPU | "THE FLEET MAGAZINE WEEKLY — practical intelligence for the people who run UK vans, trucks and company cars" |
| Lower MPU | "Sponsor a The Fleet Magazine section" |
| LinkedIn card | A follow button pointing at `/company/cogent-base-magazine`, which exists on no network |
| Article footer | "the tax, EV and running-cost intelligence UK fleet managers actually use" |
| Contact form | Posted to `jb@thefleetmagazine.co.uk`, from `noreply@thefleetmagazine.co.uk` |
| 404 page | "Search The Fleet Magazine" |
| Google News sitemap | `<news:name>The Fleet Magazine</news:name>` |
| Cookie banner | "The Fleet Magazine uses analytics cookies" |
| **Mailchimp** | **`COGENT_MC_AUDIENCE = 'SmartSME'` — so every Fleet and Golf Resort signup resolved to Smart SME's audience** |

The last row is the one that matters. Everything above it was embarrassing;
that one moved real reader data into the wrong list, and it had been doing so
since the parent/child split.

**Why nothing caught it.** Every existing guard was pointed the wrong way.
`verify-title.mjs` reads the database and the REST API — it never opens the
theme. `check-pages.mjs` asks whether a page renders, not what it says. And the
human check is worse than useless here: whoever builds a title looks at that
title, and the title being looked at is never the title being harmed. Fleet's
own site was correct throughout. This is the same blind spot as the orange
masthead and the hardcoded category list, and it will keep recurring for as long
as "shared code names a title" is a thing a person has to notice.

**The fix, and why it is not "be careful with the strings".** The parent now
holds no title name anywhere. `cogent-base/inc/brand.php` exposes
`cogent_brand( $key )` over a filterable array, and every default in it is
*derived* — from `get_bloginfo( 'name' )`, from the site's own host, from
`admin_email`. A child that configures nothing still says its own name, because
no other title's name exists in the file to fall back to. Title #4 is safe on
the day it is created, before anyone writes a line of config for it.

Where no honest default exists — a LinkedIn company page — the default is empty
and the card renders nothing. A missing card costs a follow; a card pointing at
a competitor title costs the reader's belief that anyone is looking after the
site.

**The guard.** `cogent-base-theme/scripts/check-title-agnostic.mjs` fails if a
theme names a publication it has no business naming:

```bash
node scripts/check-title-agnostic.mjs --all
```

It checks the parent (zero title names allowed) and every child beside it (its
own title allowed, all others not). Comments are exempt, so the incident notes
in the parent can keep naming the titles; only block comments and whole-line
comments are stripped, never a trailing `//`, so a domain inside a string
literal cannot hide behind one. **When a title launches, add it to `TITLES` in
that file** — a title the guard has never heard of is a title it cannot protect.

**The general form, and it is the sharpest version of THE RULE in this
document:** a shared component must not be *able* to name a title. Not "must not
currently name one". Copy is code. A sentence in a parent theme is a
single-title assumption exactly as much as a hardcoded category list is, and it
survives longer because it compiles, renders, and looks completely fine on the
site you are testing.
