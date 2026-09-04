# Launching a title: the playbook

Written after title #2, The Fleet Magazine, on 17 August 2026 — the first time
the multi-title engine was actually used to launch a title rather than to
describe one. Roughly six hours end to end, of which perhaps ninety minutes was
the work and the rest was discovering traps.

The point of this document is that title #3 should take ninety minutes.

Updated 17 August 2026: both titles now run on the shared cogent-base parent
theme, deploy over SFTP and pass scripts/verify-title.mjs. Title #3 starts by
copying an existing child, not by forking a theme.

Updated 25 August 2026, after titles #3, #4 and #5 all launched without this
document being revised — and after a full fleet audit found what that cost.
Five titles are live. The new material is §3's per-child filter traps, the
verification traps (a clicked Run button, a `G-` grep, a "private" repo), §4's
extra checklist lines, and §12, which is the list of everything a title now
needs that is NOT a WordPress setting. Read §12 before starting #6.

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

### A new site's WAF may 403 the title's own bot user-agent
Barbering Business's freshly created SiteGround site (24 Aug 2026) serves a
server-level 403 to any request whose user-agent is `<TitleName>Bot/1.0` —
the exact string `batch-publish.js` builds — while `CogentBot/1.0` and
non-"Bot" strings pass, and the older sites' servers allow all of them. The
block is SiteGround's plain-text 403 page, not WordPress, so nothing in
wp-admin shows it. The batch publisher now sends `<TitleName>Editorial/1.0`;
own-site calls in `lib/` always used `CogentBot/1.0` and were never affected
(`lib/newsletter.js` documents the same lesson from Mailchimp's side). Check
for a new title: `curl -A "<TitleName>Bot/1.0" https://<domain>/wp-json/` —
a 403 here means the WAF rule is live on that server.

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

### The desktop nav's alignment leaks into the mobile overlay
`wp:navigation` with `justifyContent:"right"` is correct for the desktop row
sitting beside the search. Core feeds the same value into
`--navigation-layout-justification-setting`, which the overlay also reads, so
every item in the open hamburger menu stacked against `flex-end`. Combined with
the next trap it put the right edge of every menu item on the right edge of the
screen — measured at x=375 of 375 on all three titles.

Do not fix it by changing `justifyContent` in the child's `parts/header.html`:
that moves the desktop nav in from the right and leaves a hole where it sat. The
parent answers it for the overlay only, in the `Mobile nav overlay` section of
`cogent-base/style.css`.

### Core's overlay padding silently evaluates to zero
Core sizes the open overlay with
`padding: clamp(1rem, var(--wp--style--root--padding-top), 20rem)` and friends.
`cogent-base/theme.json` sets no root padding, so each middle term is an empty
token, all four declarations are invalid, and the overlay computes to
`padding: 0`. Nothing warns you; the menu just touches the bezel.

### `disable-default-overlay` is not the escape hatch it looks like
Core 7.0 added a class that turns off every default overlay rule in one move,
which is exactly what a theme restyling the overlay wants. It also carries
`.disable-default-overlay.is-menu-open ... > :not(.wp-block-navigation__overlay-container) { display: none }`.
It is the switch for core's own custom overlay-content block, and setting it
without providing that block hides the entire menu. Beat core on specificity
instead — and note that core's overlay rules wrap the gating class in `:where()`,
which contributes nothing, so the number to beat is smaller than it looks.

### Overriding core block CSS half-applies, which looks like success
The first attempt at the overlay used `.site-nav .is-menu-open <target>` (0-3-0)
against core's 0-4-0. `font-size` and `display` applied because nothing competed
for them; `padding-block` silently did not. The result was a left-aligned menu
with 23px rows instead of 55px — visibly fixed, quietly still wrong. When
overriding a core block, measure a computed value afterwards rather than reading
the rendered page.

### The parent stylesheet was versioned by the CHILD's version number
`wp_get_theme()` with no argument returns the child once one is active, so
`cogent-base/functions.php` stamped both stylesheets with the child's version.
That made the parent's version number decorative: a parent-only change shipped
to all three titles under a query string none of them had changed, so browsers
and the SiteGround edge both kept serving the old CSS and the change looked like
it had never deployed. Fixed to `wp_get_theme( get_template() )` for the parent
handle. If a shared CSS change ever appears not to land, check this first.

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

### The byline user's SLUG is load-bearing, and each title now names its own
`cogent-base/inc/author.php` forces the author of every post through a
`wp_insert_post_data` filter, so whichever account publishes, the byline is the
one the theme resolves. The identity used to be a fleet-wide constant naming one
person. Since 25 Aug 2026 it is a filter each child answers:

```php
// child functions.php
add_filter( 'cogent_author_slug', function () {
	return 'declan-wale';
} );
```

The parent still falls back to `james-burke`, and `cogent_author_id()` still
falls back to **user ID 1 — the administrator — when the slug does not resolve**.
That fallback is silent. It is how title #3 published every article under the
admin account: it created its byline user as `jamesburke`, so the nicename was
`jamesburke`, the lookup missed, and nothing errored. `wp post update
--post_author=3` even reported `Success:` and changed nothing, because the filter
reassigned it on the way back in — which reads exactly like a broken wp-cli.

**Order matters, in both directions.**

1. **Create the byline user BEFORE deploying the theme.** Deploy first and every
   post bylines to the administrator until the user exists.
2. **Reassign existing posts AFTER the theme is live.** The currently-deployed
   theme forces posts back to *its* author on every save, so a reassignment run
   before the deploy is silently undone.

**`wp user get <slug>` matches the login, not the nicename.** These are different
fields and they drift apart. On Smart SME the administrator's login was
`jb@cimltd.co.uk` but its *nicename* was already `james-burke` — so `wp user get
james-burke` found nothing, created a second user, and WordPress quietly assigned
it `james-burke-2`. The theme resolves by nicename, so it kept pointing at the
administrator while the bio and portrait sat on the new account. Check both
fields before creating anything:

```bash
wp user list --fields=ID,user_login,user_nicename,display_name,roles --format=csv
```

If the nicename is taken by an account that should not be the public byline,
free it first, then claim it:

```bash
wp user update 1 --user_nicename=jb-admin
wp user update 3 --user_nicename=james-burke
```

**Duplicate display names break `resolveAuthor()`.** It matches on display name
or slug and returns the first hit, so three accounts all called "James Burke"
resolve unpredictably and `check-all-titles.mjs` fails on the byline check. Only
the byline account should carry the person's name; call the engine account
`Engine`, the same as every other title.

**The portrait is found by attachment slug, not by user.** Drop one image into
the media library whose slug matches the author slug and the card picks it up;
without it the card falls back to initials, which is a deliberate design, not a
missing asset.

```bash
ID=$(wp media import /tmp/declan-wale.jpg --title="Declan Wale" --porcelain)
wp post update $ID --post_name=declan-wale
```

Check the rendered byline on a live post before running a batch — the value you
passed in proves nothing.

### A shared default that is one title's data blanks every other title's page

`cogent-base/inc/homepage.php` held `COGENT_SECTIONS` as a bare constant
carrying Smart SME's category slugs. The homepage plan only allocates articles
to slugs on that list, and `cogent_category_section()` returns `''` for a
section the plan gave nothing to — so Fleet, Golf, Barbering and Airport each
rendered a hero, a Latest grid and then **nothing**, losing 24–32 internal
links per homepage. `sidebar-explore.php` had its own copy of the same list and
collapsed to a single News link.

It survived four launches because the failure looks deliberate: hiding a thin
section IS intended behaviour, so an empty middle reads as "not enough articles
yet" rather than as a bug. And `check-title-agnostic.mjs` could not see it —
that script matches title NAMES and DOMAINS, and `ai-automation` is one title's
identity expressed without its name.

It is now `cogent_home_sections()`, a filter every child must answer:

```php
add_filter( 'cogent_home_sections', function () {
	return array( 'news', 'investment-ownership', /* … in home.html order */ );
} );
```

Two rules. The list must be in the same order `home.html` renders the section
patterns, and it must contain exactly those slugs: a slug listed here but not
rendered has its articles reserved by the plan and then shown nowhere at all.

**The general lesson, which is the one to carry into #6:** a shared default
that happens to be correct for the title you are looking at is invisible on
that title and broken everywhere else. When you add anything to the parent that
holds a list, a slug, a name or a URL, make it a filter with a derived default
on the first day, not on the day someone notices.

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

### Site Kit tags with a `GT-` container ID, so grepping for `G-` finds nothing

Checking a live page for `G-XXXXXXXX` to prove GA4 is firing returns **nothing
on a correctly tagged site**. Site Kit emits a `GT-` container ID
(`googletagmanager.com/gtag/js?id=GT-…`), which loads the GA4 config behind it.
A 25 August audit reported two titles as recording no analytics on exactly this
basis; all five were fine.

Grep for the loader, not the measurement ID:

```bash
curl -s -A "Mozilla/5.0 …" https://<domain>/ | grep -o "gtag/js?id=[A-Z0-9-]*"
```

A false negative here is expensive in the wrong direction: it sends you
re-tagging a site that was already tagged, and twin tags double-count every
visit. Confirm before touching anything (and see §10's three-part check).

### A new GitHub repo is PUBLIC by default, and "I made it private" needs proving

Six theme repos were created on 25 August; five came out public because the
visibility radio defaults that way, and one stayed public after they were
"all" flipped. These repos hold the live site themes.

Check it the way an outsider would, with no credentials — 404 means private,
200 means the world can read it:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/repos/JBMEPCA/<repo>
```

Also: create the repo **empty**. Ticking "Add a README" gives it a commit, and
pushing an existing local history onto that is a rejected non-fast-forward —
which tempts a force-push over the top on day one.

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

### A clicked Run button is a report, not evidence — verify the effect

On 25 August four commands were handed over and reported as run. None had
executed. It was provable in seconds and only because someone looked: the live
homepage still showed one section, `git rev-list origin/main..main` still said
3, and the newest wrangler log was eleven days old.

Never take "I ran it" as the state. Check the thing the command was supposed to
change — the rendered page, the remote ref, the log file's date — and check it
before building anything on top. This is the same discipline as §7: what the
system reports about itself is not what the system did.

### `npx` is blocked on this machine, so call package bins through `node`

PowerShell script execution is disabled, which kills `npx <anything>` — and
that is exactly how `cloudflare/README.md` documents deploying the worker, so
the documented command cannot work here. Install into a scratch directory and
invoke the bin directly:

```bash
npm install wrangler          # in a scratch dir, NOT the app
node <scratch>/node_modules/wrangler/bin/wrangler.js deploy
```

Run it from `cogent-incubator/cloudflare` so it finds `wrangler.toml`. Do not
add wrangler to the app's `package.json` to work around this: it is a large
dev dependency and Vercel would install it on every build for nothing. JB's
wrangler OAuth (3 Aug) persists in `~/AppData/Roaming/xdg.config/.wrangler`, so
no fresh login is needed.

### The play button runs Windows PowerShell 5.1, which rejects `&&`
Two separate instructions failed on this before anyone noticed, because the
failure is a parser error before execution and looks like nothing happened at
all — including an `npm i -g` that appeared to have run and had not. PowerShell
5.1 needs `;` with `if ($?)`. Any command written for someone to click must be
PowerShell, not bash.

---

## 4. Pre-flight checklist for the next title

Run these before touching a console.

```
□  Read §12 — everything a title needs that is not a WordPress setting
□  git rev-list --count origin/main..HEAD   → must be 0, or deploy first
□  vercel ls → newest Production deploy is NEWER than your last commit
      → the git hook does not always fire; pushed is not deployed
□  grep -rniE "<previous title name>" lib/ scripts/ app/ --include=*.js --include=*.jsx
      → every hit is a tenancy bug waiting to happen. INCLUDE app/ AND .jsx:
        the old form checked neither, so four smartsme.co.uk hardcodes sat in
        the dashboard for months while this checklist passed clean
□  New child declares cogent_home_sections, cogent_author_slug and
   (if it has a page) cogent_author_linkedin
      → miss the first and the homepage renders an empty middle that looks
        deliberate; miss the second and the byline inherits Smart SME's
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

### An infrastructure fault must never wear an editorial fault's words

On 20 August the deployment lost sharp's native library, so the picture gate
threw before vision saw a pixel. The catch reported that as "image
unreachable" - an image fault - so the Designer believed it, burned four
attempts per article on candidates nothing ever looked at, and the ladder then
let the "still waiting on images" count starve the Editor and Researcher for
an afternoon, on all three titles at once. One broken .so file, read as an
editorial problem, stopped the fleet.

Three rules that came out of it:

- **Every catch must say whose fault it is.** A gate that cannot run is not a
  candidate that failed. If the error message could equally describe broken
  tooling and a bad input, it will be read as the input, and retries will be
  spent proving nothing.
- **Optimisations must degrade, not gate.** Downscaling was a token saving;
  when it broke it became a hard dependency. sharp failing now falls back to
  judging the original bytes.
- **A "work available" check must count actionable work.** The ladder asked
  "any article without an image?" when it meant "any the Designer can still
  act on?" - the difference held the whole pipeline behind a no-op.

And the deployment-side fix: sharp is in next.config serverExternalPackages,
because a bundler that wraps a native module will eventually lose its shared
libraries, and the failure only shows at runtime, on the deployed site, in the
one code path that uses it.

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

### A wire topic must carry its wire item, or it becomes an unsourceable guide

Golf Resort wrote three articles on 19 August that could never have published,
about £0.40 each. All three were news stories the Researcher had found on the
wire - a Troon acquisition, a GOLF.AI launch, drought imagery - and all three
reached the Editor as evergreen guides with no source. So the writer asserted
the event it had been told to write about, and the gate refused every one for
exactly that: "the central hook is unsourced and unlinked".

The link was dropped twice over. `ResearchTopic` had no `sourceItemId` column at
all, so there was nowhere to record which wire item a topic came from. And the
Director, which does commission `pr_rewrite` when it finds a wire item, looked
it up by exact title match against `topic.query` - a field the Researcher fills
with a composite like `"Wire: water, irrigation and sustainability - Drone
images reveal..."`. It never matched, so every wire topic fell through to
`seo_original` with a null source.

Both are fixed. Wire items are labelled `W1..Wn` in the Researcher's prompt, the
model returns the `wireRef`, and the Director reads the id.

**The check for a new title:** propose a wire topic, then confirm the article it
produces is `pr_rewrite` with a non-null `sourceUrl`. If it comes out
`seo_original` with no source, the title will burn Opus on news it cannot cite,
and the gate will be blamed for it.

Worth knowing what happens next when the source is a Google News stub: the
pre-draft gate below parks the piece for £0.00. Verified end to end on 19
August - a real rejected topic re-armed with its wire item was commissioned as
`pr_rewrite`, hit the gate, and cost nothing. The same topic had cost £0.40 the
day before.

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

### The gate raises a NEW objection each round — cap fresh drafts at two, then park and repair

Airport's cost-to-build pillar (24 Aug 2026) was held three times at ~$0.55 a
round, and the objections never repeated: round one questioned figures, round
two questioned dates the brief had supplied, round three wanted a second
outbound link. Each fresh draft is a new roll of the dice against a gate that
can always find something, so the loop does not converge — it just bills.
After two paid drafts, stop: the parked draft is usually 95% done with one or
two actionable faults, and the repair path on the EXISTING draft is the owner
of the last 5%, not another $0.60 rewrite.

The countermeasure that works on the way in: **SOURCE ANCHORS in the brief.**
For any fact newer than the model's memory — Heathrow's £49bn (Bloomberg, Nov
2025) reads as invented to a gate that remembers £14–30bn — the brief carries
the figure WITH its dated source and the line "these are pre-verified
commissioning facts; carry them with their attributions, do not re-verify".
Airport's money pillar was held on round one and published clean on its first
re-run after anchors went in. Write the anchors into the brief BEFORE the
first draft on any title whose beat moves faster than a training cutoff —
which is every news title we will ever launch.

### One SiteGround server, one system user PER SITE — keys and paths do not carry over

All five titles sit on the same box (c1116205.sgvps.net), which invites the
assumption that one SSH credential covers them. It does not: each site gets
its own user (barbering u20-cylyohvu5mzm, airport u21-fqeyi6rqrqqm), the
deploy key must be imported in EACH site's SSH Keys Manager, and the sftp
credential's themePath embeds `/home/<that-site's-user>/` — cloning
barbering's payload for airport silently produced a path into barbering's
home. When cloning a credential shape, the home directory is part of the
username, not part of the shape.

### Site Kit and the parent's GA4 filter coexist correctly — verify with one option read

Airport launched with JB's Site Kit install doing the tagging while the child
also set `cogent_ga4_id`. This is fine BY DESIGN — the parent's tag stands
aside when Site Kit is genuinely tagging — and the page served exactly one
tag. Two things to know before calling it broken: Site Kit emits the `GT-`
Google-tag alias, not the `G-` measurement ID, and the same property answers
to both; and the one-command check is
`wp option get googlesitekit_analytics-4_settings` — propertyID,
measurementID and `useSnippet: true` in one read, no OAuth spelunking.

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

### A rejection rule reads as a requirement, and stock photography cannot meet it

The picture gate in `lib/qa.js` was told: *the article names specific brands and
the image shows a DIFFERENT brand — reject.* That is a rule about wrong logos.
Haiku read it as a rule about right ones, and started rejecting photographs for
being *generic*: "no identifying features linking it to Cornerstone Club", "no
visual confirmation this is the Quartix system". No stock library has a picture
of a named private members' club, so for any news story about a named
organisation the gate was unwinnable — 27 Designer runs across Fleet and Golf on
19 and 20 August 2026, every one of them reported as a success, and not one
picture. Twelve live articles across the three titles had no header image at
all, and the count only came out when something finally measured it.

Fixed by saying the quiet part in the prompt: the photograph is a stock image,
it is not expected to depict the organisation, and "generic" is not a fault. The
wrong-logo rule survives intact, and correctly still holds a story about a BYD
Sealion 7 that stock can only illustrate with a Kia.

**The general rule: a gate written as a list of rejections needs its acceptance
condition written down too, or the model will invent one.** Check it against the
work it will actually see — a rule that is obviously about logos when you have
the failing example in front of you is not obviously about logos to a model
holding one photograph.

Two smaller things fell out of the same investigation, and both generalise:

- **A caller that invents the reason for a failure destroys the evidence.**
  `chooseSmartImage` returned a bare `null`, and the Designer reported "every
  candidate failed the visual check" — which was a guess. It reads identically
  whether the gate rejected five photographs, the search returned none, or the
  downloads 403'd, and those need three different fixes. Return the reason.
- **A deterministic retry is not a retry.** The Designer re-ran every 30 minutes
  for as long as an article sat in the queue, and the search seed came from the
  title, so run twelve reissued run one. Vary the attempt, cap it, and escalate
  once — `MAX_IMAGE_ATTEMPTS` in `lib/agents/team.js`.

And the reason it published anyway: **`publish-due` guarded every branch on
`article.imageUrl`, so an article that never got one fell past all of them.**
The file's own header comment said an article waits rather than going out
without a picture. That was true of a picture the re-check rejected and untrue
of a picture that was never sourced. When a guard is written as "if X is bad,
stop", check what happens when X is absent.

### `NOT { field: { startsWith } }` is false for a NULL field, and hides sources

`app/api/cron/scan-feeds` split its sources into news searches and everything
else, with `NOT: { feedUrl: { startsWith: "https://news.google.com/…" } }` as
"everything else". In SQL that is `NOT (feedUrl LIKE '…%')`, which for a NULL
`feedUrl` evaluates to NULL — not true — so the row is dropped.

Every brand that had never had a feed discovered therefore had a NULL `feedUrl`
and was invisible to the rotation, and the rotation is the only thing that runs
discovery. Nothing new could ever be scanned: **discovery ran exclusively on
brands that no longer needed it.** It hid 68 of Fleet's 97 sources, 30 of Golf's
88 and 789 of Smart SME's, and it took Fleet's four trade bodies with it — BVRLA,
Logistics UK, the RHA and Zemo — which on a fleet title is most of the news that
is worth having.

Nothing errored and no count was ever wrong on its own terms. `scripts/check-feed-coverage.mjs`
exists to make it visible: it buckets every brand the way the cron does and
checks that the buckets add up to the total. **Run it after seeding a title's
sources.** A source list is not a source list until something has read it.

### Aim for feeds, but budget for the ones that have none

The playbook already says to autodiscover feeds and aim for 30+ before launch.
What it did not say is what to do about the misses, and on Fleet the misses were
the four most valuable sources on the list. Three of them have no RSS anywhere:

| | what it has | how it is read |
|---|---|---|
| Logistics UK | WordPress whose news is a `blog` custom post type; the default `/feed` is a valid, permanently **empty** channel | the real URL, `?post_type=blog` |
| RHA | bespoke CMS, server-rendered listing | anchors matching `/news/news/detail/` |
| Zemo | same, with the date in the link text | anchors matching `/news-events/news,` |
| BVRLA | Kentico, listing rendered **in the browser**, no API a server can call | `sitemap.xml`, diffed between scans |

They live in `lib/newsrooms.js`, keyed by the host of the brand's `newsHubUrl`.
Verifying one by hand takes about ten minutes and it then runs for ever, which
makes it the best-value hour in a title's setup — do it during step 6, while
waiting on DNS, and do the trade bodies first.

Two traps in there worth carrying:

- **An empty feed is not a working feed.** Logistics UK's `/feed` parses cleanly
  to zero items, so it was recorded `feedStatus: "ok"` and showed a green tick
  for three days while producing nothing. There is now an `empty` status.
- **A sitemap's first scan is a baseline, not a haul.** BVRLA's lists 435 URLs
  and stamps every one with today's `lastmod`, so it cannot be sorted by
  recency. What it can answer is which URLs are new since last time — but only
  if the first scan records the back catalogue as already seen instead of
  commissioning ten arbitrary posts from 2024.

---

## 9. The one-line version

**Everything that broke was something that had only ever been true for one
title.** Prompt strings, credentials, gates, thresholds, scripts, user-agents,
link classifiers. The rebuild made the *database* multi-tenant and left the
*assumptions* single-tenant, and each one surfaced only when a second title
actually ran through it.

For the next title, the useful question is not "what do I need to set up" but
**"what in this codebase still believes there is only one title?"**

Titles #3, #4 and #5 proved the sharper version of it. By then the *engine* had
been swept — every agent prompt built from the title's own row. What had not
been swept was the parent theme's constants, the dashboard's `app/` layer and
the batch publisher, and all three were still Smart SME's. So: **being swept
once is not a property a codebase keeps.** Every list, slug, host and name
added to shared code after that sweep is a fresh single-title assumption unless
it was born as a filter. Ask the question again at every launch, of the parts
that were clean last time.

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

### The theme has to style what the engine is told to write

The drafting prompt has required "at least one real comparison table" since the
first title, and `cogent-base` had no table CSS at all. So every comparison table
on every title rendered as core ships it: no rules, centred headers, and a
two-column table split 50/50 so the one-word answers floated in the middle of a
half-empty column. It looked like pasted text. Nobody caught it for two titles
because the automated sweep only checks that a page loads, and a badly styled
table returns 200 like anything else.

The general lesson is the one this playbook keeps relearning in a new costume:
**a rule in the drafting prompt is a promise the theme has to keep.** When you
add a required element to the house style, style it in the parent in the same
pass. Anything the prompt says the engine must produce, grep the parent for.

Two specifics worth keeping:

- **CSS cannot select on cell text**, so a verdict column cannot be coloured from
  the stylesheet alone. The classes `.v-yes`, `.v-part` and `.v-no` live in the
  parent and the drafting prompt emits them. A table written without them still
  gets every other rule and reads in muted, so it degrades rather than breaks.
- **`white-space: nowrap` belongs on the answers, not the header.** Sizing the
  last column to its content is what stops the 50/50 split, but letting a long
  column heading hold its line undoes the whole thing.

Check contrast on anything deliberately recessive. `muted-light` on the article
background is about 2.6:1, which fails AA for text that size, and a verdict
column is the last place to put text nobody can read.
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

### Analytics: three separate things must all be true
The Fleet Magazine ran six days recording nothing while looking fine. Three
distinct failures, each invisible on its own:

1. **Site Kit was never installed.** A check for `gtag(` reported the site as
   tagged — the match was the Consent Mode block in the theme's own
   `functions.php`, which defines `function gtag(){}`. **Never test for
   analytics by grepping for `gtag`.** Test for a script tag whose `src` is on
   `googletagmanager.com`, or better, load the page in a real browser and look
   for a `_ga_<MEASUREMENT_ID>` cookie. `curl` never fires a JavaScript tag, so
   a fetch-based probe can only ever prove the tag is *present*, never that it
   *runs*.
2. **Connected is not the same as tagging.** Site Kit can have `analytics-4` in
   its active modules while its separate `useSnippet` switch is off, and it then
   emits nothing at all. Check
   `wp option get googlesitekit_analytics-4_settings`.
3. **The property in the URL is not the property you created** (see above).

The parent theme can emit the tag itself from a per-title `cogent_ga4_id`
filter, which avoids the OAuth-per-title that Site Kit needs — it stands aside
automatically when Site Kit is genuinely tagging. Whichever route a title takes,
verify with the cookie, and confirm the GA4 API returns non-zero for the
property before calling analytics done:

```
node scripts/check-analytics-wiring.mjs
```

---

## 11. Loading a title's subscriber list

Written up on 25 August 2026, when Fleet, Golf and Airport were loaded from raw
Apollo exports in one pass. Smart SME's list took weeks and a pile of one-off
scripts; this took an afternoon because the shape was already known.

**Never upload an Apollo export to Mailchimp.** Apollo's own "verified" flag was
wrong for 11% of Smart SME's first tranche. On an established domain that is a
bad morning; on a title whose sending domain is a week old it is the whole
domain's reputation. Everything below exists to put only proven-deliverable
addresses in front of a young domain.

### The pipeline

```
Apollo export
  → scripts/rank-prospects.mjs        rank, dedupe, free kills → ranked-<slug>.csv
  → scripts/mv-bulk-verify.mjs        one bulk file per title  → mv-report-<slug>.csv
  → scripts/seed-title-prospects.mjs  load into NewsletterProspect
  → /api/cron/subscriber-drip         import to Mailchimp, tranche by tranche
```

The first three are one-offs per title. The fourth is the standing machinery and
already fans out across the fleet — a title joins it by having prospect rows and
a `mailchimp` credential, not by any new code.

### Spend nothing on contacts that were never going to pass

Verification is the only part that costs money, so the ranker kills as much as
it can for free first, in this order: unparseable emails, duplicates (in-file
and across titles — the higher-scoring title keeps a shared contact), addresses
on **Apollo-flagged catch-all domains**, domains with no MX and no A record, and
any address another title has already verified.

Catch-all is the big one: it was 25-40% of each list. MillionVerifier can never
return `good` for a catch-all domain, so paying to check one buys a `risky` that
the drip suppresses anyway. Kill them at the door.

Verdicts carry across titles for free, in both directions. The verdict is about
the mailbox, not the magazine.

### Rank before you verify, because verification works top-down

`rank` is the column that decides everything downstream: both the bulk slice and
the daily drip take the next N live rows by rank. So a bad ranking does not just
reorder the list, it decides which contacts get bought and which never get
looked at. Score on title-relevance (a strong role match is worth more than
seniority — a course manager beats a CEO of something unrelated), then
seniority, then a light home-market boost for a UK title, then email-freshness
signals as a tiebreak only.

Suppressed rows sort to the bottom before ranks are assigned, so rank order and
"what to verify next" are the same thing.

### The launch tranche is a bulk file, not the daily drip

The 200-a-day API drip is right for the long tail and far too slow for a launch:
1,000 contacts is a working week. MillionVerifier's bulk API does the same job
in about fifteen minutes, so a launch tranche is one file upload per title and
the drip takes over at tranche 2.

Verify more than you intend to import — roughly 1.4x, since the good rate runs
70-80% after the free kills. `mv-bulk-verify.mjs` refuses to start unless the
account holds enough credits for every title in the run, because a half-verified
list is worse than an unverified one: it looks finished.

### Traps

**Prospects are seeded but never marked imported.** `importedAt` stays null for
every row the seeder writes, even ones verified good. Mailchimp membership is
`runDrip()`'s to claim, and it stamps the tranche number itself. A seeder that
pre-marks rows as imported produces a list that is in the database and not in
Mailchimp, and nothing will ever notice.

**A title with no `mailchimp` credential is skipped silently.** Both the drip and
the newsletter check `mailchimp.audienceId` before doing anything and return a
`skipped` reason rather than failing. Fleet and Golf had audiences, authenticated
sending domains and — for a day — no credential row, so every cron would have
reported a clean run over a title it never touched. Check
`SiteCredential.kind = 'mailchimp'` exists per title, not that the audience
exists in Mailchimp.

**`/verified-domains` returns 10 results by default.** Pass `?count=200` or a
sending domain that is fine looks missing.

**Scripts that do not import Prisma get no `.env`.** Prisma loads it as a side
effect, so a script using only `fetch` and `fs` sees an empty `process.env` and
reports the key as missing. Run standalone scripts with `node --env-file=.env`.

### Pacing the first sends

A first issue to a cold list on a young domain is the highest-risk send a title
ever makes, and `MAX_BOUNCE_RATE` (2%) means a bad one blocks the *next*
import too — the ramp stops itself. On an established domain the full 1,000 is
fine. On a domain with no sending history, or one already seen in a spam folder,
import ~500 (`?mode=import&size=500`) and let the Tuesday drip grow it.

---

## 12. Everything a title needs that is NOT a WordPress setting

Added 25 August 2026, after a fleet audit found that titles #3, #4 and #5 each
launched "successfully" and were each missing several of the items below. None
of these are visible in wp-admin, none of them break anything loudly, and every
one of them was found weeks later by looking rather than by being told.

Work through this list AS WELL AS §2's ordered sequence.

### Per-child theme filters

Every one of these lives in the child's `functions.php`. The parent's defaults
are derived and safe-looking, which is exactly why a missing filter is quiet.

| Filter | Miss it and… |
| --- | --- |
| `cogent_brand` | copy, contact address and Mailchimp audience stay generic |
| `cogent_home_sections` | the homepage renders a hero and an empty middle (§3) |
| `cogent_author_slug` | the byline, author archive and schema inherit another title's person |
| `cogent_ga4_id` | nothing, IF Site Kit is tagging — verify, do not assume (§10) |
| `cogent_author_linkedin` | the author card simply omits the link, which is correct until a page exists |

### Database facts the engine reads

- **`Site.markets`** — ISO codes, in priority order, default `["GB"]`. A global
  title MUST carry its real list (Golf and Airport are `["US","GB"]`). This is
  what makes a title *know* it is global: it drives which Google editions the
  Researcher's autocomplete lane queries, and the batch publisher's
  market-sensitive prompt lines (currencies, regulators, which providers a
  reader would recognise). Before this column existed, "is this title global?"
  was answerable only by reading prose in `audience`, and every locale decision
  was a code edit in two files.
- **`Site.dailySpendCapUsd`** — set on the new title *and* confirm every
  existing one still has theirs.
- **`newsletterEnabled` / `linkedInEnabled` / `outreachEnabled`** — seed all
  three OFF. See the gate below for when outreach earns its switch.
  (`linkedInEnabled` is currently read by nothing — a known no-op, do not rely
  on it to pause anything.)

### Publisher identity

Run once the site is live and has its palette:

```bash
node --import ./scripts/_register.mjs scripts/set-publisher-logo.mjs --site=<slug>
```

Yoast only emits an `Organization` node when `wpseo_titles.company_name` AND
`company_logo` are both set. Four of five titles had `company_or_person` set to
`company` with both fields empty, so their pages carried **no publisher entity
at all** — every article named itself as publisher, with no logo, which is the
one signal Google News and Discover both want. The script renders the mark the
theme already draws as its favicon at 512px, uploads it, and patches the Yoast
options over SSH. It skips a title that already has a logo unless `--force`, so
it cannot overwrite real artwork.

**Google News Publisher Center is not a step.** Manual publication submission
was removed; Google auto-generates publication pages and states that
policy-compliant content is automatically eligible via its normal crawl. A new
title with a news sitemap and clean crawlability is already eligible. Do not
spend an hour trying to register one.

### Version control, on the first day

The title's site folder is a git repo before it is a live site, not after.
Titles #3, #4 and #5 went live with no `.git` at all and existed solely on one
laptop and on SiteGround for a week.

```bash
git init -b main && git add -A && git commit -m "…"
```

Then a **private** GitHub repo named after the folder, remote added, pushed —
and the visibility verified with the anonymous `curl` in §3. Create it empty.

### Outreach: the gate, and the switch that lies

- **Do not enable outreach until the title has ~20 published articles.** A
  campaign that lands a prospect on a homepage with one article and six empty
  section headings converts worse than no campaign and burns the first
  impression with exactly the audience you most want.
- The switch **drafts and sends autonomously** — it has since 21 Aug 2026. The
  Backlinks page is an override window before the next hourly tick, not a gate
  the mail waits behind. Sends are capped at 5 per run and 25 per title per day.
- Enabling it needs four things true, not one: `engineEnabled` and a status off
  `setup`; `outreachEnabled`; a `SiteCredential(kind:"outreach")` seeded with a
  **real Workspace mailbox**; and domain-wide delegation carrying BOTH
  `gmail.send` and `gmail.readonly`, entered in one go.
- The seeds set `authorEmail` to `news@news.<domain>`, which is a Mailchimp
  sending subdomain and **not** a Workspace user. Seeding the outreach
  credential with it fails at token mint. It fails loudly, so this is a trap
  rather than a hazard — but it is the likely first stumble.
- `lib/reachability.js` is a UK SME tech/banking denylist. It has no coverage
  for any new vertical, so a new title will start by emailing its sector's
  household names. Add its obvious non-responders before switching on.

### Mail and social, which are neither theme nor engine

- A Mailchimp **audience** whose name matches the child's `mailchimp_audience`
  exactly, AND an authenticated `news.<domain>` **sending domain**. Both were
  missed on earlier titles; the sending-domain half is not in §2's sequence.
- **No `news@` user on the root domain** — that decision was taken 24 Aug 2026;
  news goes through the subdomain.
- A **LinkedIn company page**. Four of five titles still have none, which is
  why `cogent_author_linkedin` and the sidebar card render nothing. It is the
  longest-outstanding item on every launch tracker, so do it early or accept it
  will still be open at the next launch.

### Before calling it launched

```
□  node scripts/verify-title.mjs --site=<slug>      → 20/20
□  node scripts/check-all-titles.mjs                → every title, not just this one
□  node scripts/check-pages.mjs --site=<slug>       → about/contact/privacy/editorial exist and are not thin
□  node scripts/check-analytics-wiring.mjs          → then view-source for gtag/js?id=
□  curl the homepage: category sections render, Explore card lists THIS title's topics
□  curl the homepage: "@type":"Organization" with a logo
□  Anonymous curl of the GitHub repo returns 404
□  Write the launch tracker (docs/<slug>-launch.md) — title #3 never got one,
   and it is the least documented title as a direct result
□  Add what you learned HERE, the same day
```

### Arming a title's newsletter

`scripts/newsletter-readiness.mjs` answers "why is this title not sending" in
one call, because every gate in the send path returns `skipped` rather than
failing — a title that is not ready looks exactly like one that had a quiet
week. Six gates: mailchimp credential, a non-empty audience, an authenticated
sending domain, ten articles with images, its own wordmark, and the switch.

Order of operations, once the list is loaded (§11):

```
node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/newsletter-readiness.mjs <slug>
node ... scripts/pin-lead.mjs <slug> "<headline fragment>"      # optional
node ... scripts/newsletter-proof.mjs <slug>                    # renders to a file
node ... scripts/send-proof.mjs "a@b.com,c@d.com" <slug>        # real Mailchimp test send
node ... scripts/set-newsletter-enabled.mjs <slug> on           # arms Thursday
```

Send the proof to a person before arming. It is the only way to see the merge
tags resolve and the masthead render in a real client, and it doubles as a free
deliverability read on a young sending domain — where the proof lands is where
the issue will land.

**Ten articles with images is a hard floor**, and it is what keeps a new title
waiting: barbering had 5 and airports 6 on the day their lists were ready.

**The schedule is not per title.** The Cloudflare worker fires
`/api/cron/newsletter` at 09:00 UK on Thursdays and the route fans out over
every title whose switch is on. Arming a title *is* scheduling it; there is no
second place to set a time.

### The fleet run has a wall clock, and exceeding it is silent

`maxDuration` is 300s. A run that overruns does not fail loudly — the titles it
never reached simply get no issue, and the ones that did send make the week look
fine. Measured on 25 Aug 2026: three titles took **202s**, which left no room
for the fourth and fifth.

The cause was `/reports?count=200`, a ~20s call fetching the whole ACCOUNT's
campaign history, run twice per title — once for the deliverability gate and
once for the repeat-send guard — for data identical across titles. Fetching it
once per run took the same three titles to **88s**, and five to roughly 135s.

The cache is invalidated immediately after any send. That is the part that
matters: without it the repeat-send guard could read a snapshot taken before the
issue it is checking for, and the protection against sending twice would be
looking at the past.

**Before adding the sixth title, re-measure with `?dry=1` and compare against
300s.** Per-title marginal cost is about 23s, so the ceiling is roughly a dozen
titles — after that the route needs to run one title per invocation.
