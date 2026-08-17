# Launching a title: the playbook

Written after title #2, The Fleet Magazine, on 17 August 2026 — the first time
the multi-title engine was actually used to launch a title rather than to
describe one. Roughly six hours end to end, of which perhaps ninety minutes was
the work and the rest was discovering traps.

The point of this document is that title #3 should take ninety minutes.

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
7. **Install WordPress, the theme, and Yoast + Site Kit.** Yoast *before* the
   first publish — see §3.
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
A local path in an `sftp -b` batch file must use forward slashes: the parser treats  as an escape, so `C:UsersCIM Ltd...` arrived as `C:UsersCIM Ltd...` and every upload failed. Also make directories with `ssh mkdir -p` rather than sftp's `-mkdir`, which prints a Failure line for every directory that already exists and buries real errors.

### A theme's parent is stored in the DATABASE, not read from style.css
Converting a standalone theme to a child by adding  to
style.css does nothing on its own. WordPress keeps  in wp_options from
when the theme was activated, so it kept looking for the parent inside the child's
own directory and every pattern that called a parent function fatalled with a 500.
Fix with  over SSH, or by re-activating the
theme in wp-admin. wp-cli is available on SiteGround and is much the faster route.

### theme.json preset arrays are REPLACED by the child, not merged
A child declaring two font families silently drops the parent's other two. List
every palette colour and every font family in the child, even the unchanged ones,
and keep a copy of any font file the child declares —  resolves against
the theme that declares it, not the parent.

### Git Bash rewrites Unix absolute paths in arguments
 reached the script as
, and the first parent deploy built
that entire tree inside the server's home directory. Prefix the command with
. deploy-theme.mjs now refuses a path that looks mangled.

### The GA4 property ID in the URL is the wrong one
On the property-create screen the ID in the address bar is the *previously
selected* property. Storing it silently reports the wrong title's traffic.
Verify by name through the Admin API `accountSummaries` endpoint.

---

## 4. Pre-flight checklist for title #3

Run these before touching a console.

```
□  git rev-list --count origin/main..HEAD   → must be 0, or deploy first
□  grep -rniE "<previous title name>" lib/ scripts/ --include=*.js
      → every hit is a tenancy bug waiting to happen
□  Daily spend cap set on the new title AND every existing title
□  Search set added to lib/news-searches.js and to SEARCH_SETS
□  Source list written (see scripts/seed-fleet-sources.mjs for the shape)
□  Content plan written (scripts/batch-plan-<slug>.json)
□  Sections chosen; they must match the plan's `category` values exactly
```

And after launch:

```
□  node scripts/verify-title.mjs --site=<slug>     → must be all PASS
□  HTTPS Enforce on at the host (a valid cert alone is not enough)
□  Sample Page deleted, menu defined explicitly, favicon rendering
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

**Opus was 99% of spend.** Two changes since: the picture gate moved to Haiku
across the whole codebase, and the stale brand strings that were causing
revisions are gone. Expect nearer $0.20 per article.

The remaining lever is drafting on Sonnet with the Opus editorial gate as
backstop — roughly $0.11 per article. Not taken yet, because the first titles
publish tax and compliance content where being wrong is expensive.

---

## 7. The one-line version

**Everything that broke was something that had only ever been true for one
title.** Prompt strings, credentials, gates, thresholds, scripts, user-agents,
link classifiers. The rebuild made the *database* multi-tenant and left the
*assumptions* single-tenant, and each one surfaced only when a second title
actually ran through it.

For title #3, the useful question is not "what do I need to set up" but **"what
in this codebase still believes there is only one title?"**
