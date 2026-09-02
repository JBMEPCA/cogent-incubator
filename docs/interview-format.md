# The interview format

Locked by JB on 1 September 2026, after the first one published:
[SME Leaders: Martyn Barklett-Judge on proving it to the vets](https://smartsme.co.uk/sme-leaders-martyn-barklett-judge-on-proving-it-to-the-vets/).

**Stick to this shape.** Every title runs its own version of the franchise under
its own name, and the whole value of it is that a reader recognises the second
one as the same thing as the first. Deviate only where a subject genuinely does
not fit, and say so when you do.

---

## The page, top to bottom

| Element | Rule |
|---|---|
| Headline | The franchise name in a `<span class="franchise-eyebrow">`, then a person-led headline. The span goes INSIDE the post title, not in the body. See the names below. |
| SEO title | The same line as plain text, set on `_yoast_wpseo_title`, so no markup reaches a search result or a browser tab. |
| Standfirst | Two sentences. What they won or did, then what a reader gets out of it. |
| Lead image | Supplied by the subject. Never scraped, never stock. |
| Company card | `.interview-company`, the first thing in the body. |
| Body | Short intro paragraph, then alternating quote and context under `<h2>` sections. |
| Quotes | `<blockquote class="wp-block-quote interview-quote">`. |
| Sign-off | One italic line: the franchise blurb and an edit note. |

## The franchise names

Set by JB on 2 Sep 2026. Deliberately NOT uniform across the fleet: each one
uses its own trade's vocabulary, which is what signals we know the sector.
Stored per title in `EngineSetting` under `interview_franchise`, alongside
`interview_title_descriptor`, which is the clause after the title's name in the
opening line of the outreach ("publisher of The Fleet Magazine, **the UK trade
title for fleet and logistics operators**").

| Title | Franchise | Headline reads |
|---|---|---|
| Smart SME | SME Leaders | `SME Leaders:` Martyn Barklett-Judge on proving it to the vets |
| The Fleet Magazine | Fleet Professional | `Fleet Professional:` Chris Welch on where the money really gets made |
| Golf Resort Magazine | Golf Resort Leader | `Golf Resort Leader:` Fraser Wilson on taking over the family firm |
| Barbering Business | In the Chair | `In the Chair:` [name] on building a shop that lasts |
| Airport Business | Airside with | `Airside with` [name] on running a terminal that works |

**Airport is the odd one and the markup differs.** "Airside with" is a phrase,
not a label, so it takes NO colon and runs straight into the person's name:

```html
<span class="franchise-eyebrow">Airside with</span> Sarah Jones on running a terminal that works
```

The other four take a colon inside the span, as the CSS and the live Pet Remedy
piece do. Get this wrong on Airport and the headline reads "Airside with:
Sarah Jones", which is nonsense.

## The company card

```html
<section class="interview-company">
  <div class="interview-company-head">
    <h2>Who are COMPANY?</h2>
    <img class="interview-company-logo" src="LOGO" alt="COMPANY" width="W" height="H" loading="lazy" decoding="async">
  </div>
  <p>Forty to sixty words: what they make, who buys it, and the thing that got them featured.</p>
  <dl>
    <div><dt>Company</dt><dd>Legal or trading name</dd></div>
    <div><dt>Website</dt><dd><a href="https://DOMAIN/">DOMAIN</a></dd></div>
    <div><dt>Sector</dt><dd>Two or three words</dd></div>
    <div><dt>Based</dt><dd>Town or county</dd></div>
  </dl>
</section>
```

**The four fields do not change.** A card whose fields vary piece to piece is
not a card. Two of them (`Company`, `Website`) are already columns on
`InterviewTarget`, `Sector` is a one-word editorial call, and `Based` comes off
the contact page we visit anyway. That is the whole point: no field needs a
lookup that can come back wrong.

**Never print a founding year taken from Companies House.** The register gives
an incorporation date, not a brand's age. PET REMEDY LIMITED incorporates in
July 2021 in a piece whose subject describes fifteen years of clinical trials,
and a separate entity trading under the name was dissolved in 2023. If the
number is wanted, ask the subject.

## Finding the logo

From the domain alone, in this order. Tested across six batch-two companies,
all six found:

1. **schema.org `Organization` logo** in the page's JSON-LD. The only place a
   site states its logo on purpose. Hit 5 of 6.
2. **`apple-touch-icon`**.
3. **A header `<img>` with "logo" in it.** Last resort and a coin flip: on
   littlesoapcompany.co.uk it returns an awards badge, not the logo. Anything
   from this tier needs a human to look at it.

Then **trim the whitespace** before uploading. Pet Remedy publish a 400x400
square that is about 40% padding, which rendered at 56x56 with the wordmark
illegible; `sharp().trim({ threshold: 12 })` took it to 343x103 and a readable
132x40 on the page. The trim is deterministic, so it helps a padded logo and
does nothing to one that is already tight. Run it on every logo.

`uploadMedia()` in `lib/wordpress.js` takes `data` (a Buffer) plus
`contentType`, so nothing needs hosting first.

## Publishing

- Publish through `publishToWordPress`, which defaults to `draft`. Show JB the
  draft before it goes live.
- Featured image: the supplied photo. Put the credit in the media `caption`
  field, because that is the field a person about to publish actually reads.
  **Never leave an instruction to ourselves in a caption**, it renders on the
  page.
- **Pin it to the homepage lead** with the `cogent_pin_until` post meta, a GMT
  `Y-m-d H:i:s` datetime. It expires on its own, so nothing has to be
  remembered, and pinning the next one takes over. Four weeks is about right.
- Then **purge the cache**, and check the article and the homepage.
- Finally, set `publishedUrl` and `publishedAt` on the `InterviewTarget` row,
  and **tell the subject** and set `notifiedAt`. That last step is the one the
  franchise exists for: the subject shares it, their employer links to it, and
  the backlink arrives without anyone asking.

## Theme

All of it lives in `cogent-base` so every title inherits it in its own brand
colour: `.interview-company`, `.interview-company-head`,
`.interview-company-logo`, `.interview-quote`, `.franchise-eyebrow`.

**Bump the parent `Version:` on every change.** The stylesheet is enqueued with
the parent's own version, so without a bump the URL does not change and no
browser that already holds a copy will ask for the new one. Purging SiteGround
does not help: the edge is not what is holding the stale file. This has now
caught two people, and there is a comment above the enqueue in
`cogent-base/functions.php` explaining it.

As of 1 Sep 2026 only smart-sme has the parent at 1.8.0. Fleet, Golf, Barbering
and Airport are on 1.3.0 and have none of this until someone deploys to them.
