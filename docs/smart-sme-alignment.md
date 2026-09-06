# Smart SME — title alignment (from JB's sheet, 4 Sep 2026)

The fourth sheet, and the publisher's own. Smart SME is the most built-out
title and had the thinnest brief: a one-line reader ("owners adopting AI"),
a four-line default house style, and an editorial standard that was the
generic format-tiers document with no reader rules at all.

**Rolled out 6 Sep 2026** by `scripts/apply-alignment.mjs`. The brief text
lives in `scripts/alignment/smart-sme.*` and is what the Site row, the seed
script and this doc all read.

## Reader

Founders, CEOs, MDs, directors and managers of any UK business under 250
staff, in any sector. Not technical, very busy, wanting to learn how AI and
modern services move a business on, and to educate their staff. Nobody who
works in a business is turned away: the broadest title in the group.

## What changed in the brief

- **The busy-owner test.** Would a busy, non-technical owner read this and act
  on it? JB's two least favourites (the £28m Innovate UK energy-storage
  challenge, Buffer versus Hootsuite enterprise pricing) both fail it.
- **The breadth test.** Is this a decision most owners face? Niche sub-sector
  product updates (manufacturing chat connectors, avatar rendering, hosting
  patents) were being published because they were on the wire. Being on the
  wire is not a reason.
- **The never rule.** Nothing negative about a named company, no bad-news
  pieces. The insolvency-and-closures wire search is gone (code and row). The
  seven warning-shaped headlines were mostly cyber, which stay as protection;
  the restaurant closure story would not run again.
- **Formats readers love, in order:** interviews, topical AI news, best-of
  comparisons with prices, how-tos. Commission in that order when close.
- **SME Movers.** Appointment news was described in the standard as a tier-2
  format and never once produced in 161 published pieces, because the "would
  an owner change a decision" test kills every appointment. Now a weekly
  round-up the Researcher is told appointments qualify for. JB's Business Live
  exemplar is the shape.
- **AI This Week for Owners.** A weekly plain-English round-up, tier 2.
- **The employee-journey angle** for SME Leaders (JB's Mirror exemplar: one
  named employee's rise at one named company).
- **Beat ownership.** Smart SME had published three fleet stories and queued a
  fourth. The standard now says fleet is a sister title's beat, and the fleet
  terms are claimed in the registry by The Fleet Magazine so the Researcher
  sees them as taken.
- **House style rewritten** around the busy non-technical owner: explain
  every term, say the point then why then what to do first, never an obvious
  stock image.

## Search

JB's terms are head terms, almost all uncovered before this: one CRM guide,
one chatbot how-to, one AI accounting round-up against the whole list. Eight
commissions queued through the Director's JB lane, and the terms claimed:

| Term | Commission |
|---|---|
| how to use AI in business | How to Use AI in Your Small Business: A Plain-English Starter Guide |
| best AI for small business | Best AI Tools for Small Business in 2026: What to Use for What |
| marketing AI | AI for Small Business Marketing |
| finance AI | AI in Small Business Finance |
| AI social media | AI Social Media Tools for Small Businesses |
| (advertiser adjacency) | Best Business Insurance, Best Business Energy Suppliers, Best Business Broadband |

These are competitive terms and a long game; the registry and the
internal-linking agent exist for exactly that.

## Commercial

Seen advertising: SEFE (Business Live), NFU Mutual and Hiscox (Business
Matters), Sage, Clearcourse, Howden, Cisco, SuperBenji, marketlocation and
Swoop (Elite Business). JB's wishlist is that list. The existing 51 prospects
were all software; the seven missing names are added, and the comparison
guides they want to sit beside (insurance, energy, broadband) are commissioned.

## Sources and PR

Six tech PR agencies named (Harvard, ITPR, Wildfire, Touchdown, Element,
Fourth Day), all added as PR agency rows. JB's answer to which press lists:
"as many as humanly possible". `scripts/request-press-lists.mjs` sends one
note per agency across every title; **held for JB's go**. Elite Business,
Business Live, Business Matters and SME Business News added as monitored
competitor feeds; none had been.

## Images

JB: obvious stock images are the thing to stop; product, industry, something
real is far better. The source-first rule went live on 30 August, and three of
the seven pieces since carry the company's own picture. Guides still fall to
stock because there is no source page. The fix is a Designer change (use the
lead product's press image or screenshot for a comparison guide): code, not
config, and a separate follow-up.

## Events

London Tech Week (June), Great British Business Show (November), B2B Expos,
Business Revival Series: in the standard as pegs and a new wire search.

## Vision, in JB's words

Covered in banners of huge brands, massive Google traffic, events and
webinars, people wanting to feature rather than being asked, number one for
loads of questions, strong GEO rankings with AI citing us. Proud: business
titans doing interviews, in-depth case studies, topical news covered in
detail.
