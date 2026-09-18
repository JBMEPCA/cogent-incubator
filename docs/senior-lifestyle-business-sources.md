# Senior Living Business: verified wire sources

Every feedUrl below was fetched on 18 Sep 2026 and returned a valid RSS or Atom
document with items; the newest-item date is recorded. **48 direct feeds**
against the playbook's 30+ target: **UK 28, Australia 7, New Zealand 8, US 5**.
Seed via `scripts/seed-senior-lifestyle-business-sources.mjs`; the feedUrls are
known-good, so autodiscovery can be skipped for them.

Scope reminder (the front-door rule): if the resident has their own front door
and a lease, licence or tenancy, the story is ours. A room and a care plan in a
CQC-registered care home belongs to Care Home Magazine. Several feeds below are
care-weighted (flagged **front-door filter**): they carry village and extra
care stories alongside care-home ones, and the Researcher must drop the
care-home items rather than rewrite them.

**Care Home Magazine's own feed (carehomemagazine.co.uk/feed/, valid, newest
18 Sep 2026) is deliberately NOT seeded.** It is CIM's title; rewriting it would
be self-cannibalisation. It belongs on the outreach exclusion list instead (see
the launch tracker).

## Ingester notes

- The gov.uk `search/all.atom?keywords=` feeds match anywhere in the document,
  so they are noisy (a COVID memorials page matched "extra care housing"). They
  are kept because they are the only machine-readable route to tribunal and
  appeal decisions. The `"use class C2"` feed is the raw material for the C2/C3
  appeal ledger: it returned a CIL appeal and a recovered appeal in its first
  ten items.
- `interest.co.nz` dates are non-RFC (`18th Sep 26, 4:01pm`); Consumer Affairs
  Victoria's `pubDate` has no timezone. Both need a lenient date parser or the
  items sort as undated.
- HealthInvestor UK and Caring Times return 100 items each with **no
  description** (title and link only): fetch the body from the link.
- Local Government Lawyer's planning feed returns the whole archive (3,528
  items). The first scan must be a baseline, not a haul (playbook §8, the BVRLA
  sitemap lesson).
- Inside Housing's feeds are ColdFusion syndication URLs
  (`/Syndication/DF.cfm?f=6&ft=10`); store them exactly as written. Its later
  living coverage runs under the "Inside Housing Living" label inside f6.
- Housing Today's only working feed is its Google News sitemap feed
  (`/5054.rss`); `/rss` and `/news/rss` 404.
- Three **valid but empty** feeds, the "empty is not working" trap: Law
  Commission `/feed/`, Birchgrove `/feed/`, Ageing Australia `/feed/`.
  Seeded hub-only so autodiscovery does not re-find the empty channel and mark
  it ok. ARCO's `/rss.xml` is valid but its newest item is from Nov 2021:
  treat as dead.

## UK: policy, regulators and data (11)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| MHCLG (gov.uk org) | https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom | 17 Sep 2026 | summary, full on link |
| Homes England (gov.uk org) | https://www.gov.uk/government/organisations/homes-england.atom | 18 Sep 2026 | summary, full on link |
| Planning Inspectorate (gov.uk org) | https://www.gov.uk/government/organisations/planning-inspectorate.atom | 18 Sep 2026 | summary, full on link |
| gov.uk search: "use class C2" | https://www.gov.uk/search/all.atom?keywords=%22use+class+C2%22 | 2 Sep 2026 | summary; appeal decisions |
| gov.uk search: "retirement housing" | https://www.gov.uk/search/all.atom?keywords=%22retirement+housing%22 | 15 Jul 2026 | summary; noisy |
| gov.uk search: "later living" | https://www.gov.uk/search/all.atom?keywords=%22later+living%22 | 8 Jul 2026 | summary; noisy |
| gov.uk search: "retirement community" | https://www.gov.uk/search/all.atom?keywords=%22retirement+community%22 | 2 Jul 2026 | summary; carries tribunal decisions (e.g. Elmbridge Retirement Village) |
| gov.uk search: "housing with care" | https://www.gov.uk/search/all.atom?keywords=%22housing+with+care%22 | 19 Jun 2026 | summary; noisy |
| gov.uk search: "event fees" | https://www.gov.uk/search/all.atom?keywords=%22event+fees%22 | 15 Jul 2026 | summary; leasehold consultation and tribunal items |
| House of Commons Library | https://commonslibrary.parliament.uk/feed/ | 18 Sep 2026 | full; broad, low hit rate |
| Regulator of Social Housing (gov.uk org) | https://www.gov.uk/government/organisations/regulator-of-social-housing.atom | 9 Sep 2026 | summary; housing associations with older-people stock |

## UK: trade, planning and property press (12). Competitor-flagged rows are monitoring sources

| Name | feedUrl | Competitor | Newest | Quality |
|---|---|---|---|---|
| Housing Today | https://www.housingtoday.co.uk/5054.rss | **yes** (generalist, later living occasional) | 18 Sep 2026 | summary, paywall on link |
| Inside Housing (incl. Inside Housing Living) | https://www.insidehousing.co.uk/Syndication/DF.cfm?f=6&ft=10 | **yes** (paywalled generalist) | 18 Sep 2026 | summary |
| Urban Living News: later living | https://urbanliving.news/category/later-living/feed/ | **yes** (small later-living section) | 18 Sep 2026 | full |
| HealthInvestor UK | https://www.healthinvestor.co.uk/feed/ | **yes** (paid deals title; care-weighted, **front-door filter**) | 17 Sep 2026 | title only |
| Caring Times | https://caring-times.co.uk/feed/ | **yes** (care trade; Care Home Magazine's ground, **front-door filter**) | 18 Sep 2026 | title only |
| Planning Resource | https://www.planningresource.co.uk/rss/news | no | 18 Sep 2026 | summary, paywall on link |
| The Architects' Journal | https://www.architectsjournal.co.uk/feed | no | 18 Sep 2026 | full |
| Show House | https://www.showhouse.co.uk/feed/ | no | 18 Sep 2026 | full |
| Local Government Lawyer: planning | https://www.localgovernmentlawyer.co.uk/planning?format=feed&type=rss | no | 17 Sep 2026 | summary; whole archive, baseline first |
| Property Investor Today | https://www.propertyinvestortoday.co.uk/rss | no | 16 Sep 2026 | summary; broad |
| Bisnow London | https://www.bisnow.com/rss/london | no | 17 Sep 2026 | full; capital deals |
| Construction Enquirer | https://www.constructionenquirer.com/feed/ | no | 18 Sep 2026 | full; scheme contracts |

## UK: advisers and operators (5)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| Carterwood (valuers and consultants) | https://www.carterwood.co.uk/feed/ | 17 Jul 2026 | full; low volume, research-led |
| Pozzoni Architects | https://www.pozzoni.co.uk/feed.rss | 16 Aug 2026 | full (text in description) |
| Cornerstone Barristers (planning chambers) | https://cornerstonebarristers.com/feed/ | 17 Sep 2026 | summary; on the C2/C3 SERP |
| ExtraCare Charitable Trust | https://www.extracare.org.uk/news/feed/ | 10 Sep 2026 | full; mixes corporate news (new CEO) with resident-facing posts |
| Rangeford Villages | https://www.rangefordvillages.co.uk/feed/ | 11 Sep 2026 | full; mostly resident-facing, operator-news hit rate low |

## Australia (7)

| Name | feedUrl | Competitor | Newest | Quality |
|---|---|---|---|---|
| The Weekly Source | https://theweeklysource.com.au/feed/ | **yes** (the AU retirement living and land lease trade title) | 18 Sep 2026 | full |
| Property Council of Australia | https://www.propertycouncil.com.au/feed | no | 15 Sep 2026 | full; runs the Retirement Living Council |
| Real Estate Source | https://www.realestatesource.com.au/feed/ | no | 18 Sep 2026 | full; village and land lease transactions |
| RetireAustralia (operator) | https://www.retireaustralia.com.au/feed/ | no | 17 Sep 2026 | full; contract-model thinking |
| Australian Ageing Agenda | https://www.australianageingagenda.com.au/feed/ | **yes** (aged care trade, **front-door filter**) | 17 Sep 2026 | full |
| Aged Care Insite | https://www.agedcareinsite.com.au/feed/ | **yes** (aged care trade, **front-door filter**) | 17 Sep 2026 | full |
| Consumer Affairs Victoria | https://www.consumer.vic.gov.au/rss | no | 11 Sep 2026 | summary; regulator, village law roadshow |

## New Zealand (8)

NZ has no trade title (brief §2). The reform is covered by the national
business desks, so these are broad feeds with a low hit rate that the scoped
wire queries complement.

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| Beehive (NZ Government releases) | https://www.beehive.govt.nz/rss.xml | 18 Sep 2026 | full; the reform bill will land here |
| RNZ business | https://www.rnz.co.nz/rss/business.xml | 18 Sep 2026 | summary, full on link |
| NZ Herald business | https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/business/?outputType=xml | 18 Sep 2026 | summary; partial paywall |
| Stuff business | https://www.stuff.co.nz/rss/business | 18 Sep 2026 | summary, full on link |
| interest.co.nz | https://www.interest.co.nz/rss | 18 Sep 2026 | summary; non-RFC dates |
| BusinessDesk | https://businessdesk.co.nz/feed | 18 Sep 2026 | summary; paywalled |
| Newsroom | https://newsroom.co.nz/feed/ | 18 Sep 2026 | full |
| Property Council New Zealand | https://www.propertynz.co.nz/feed | 16 Sep 2026 | full |

## US: capital markets and benchmarks only (5)

The US is SHN and McKnight's territory; we take capital deals that move UK
money and benchmark data, never US operator news for its own sake.

| Name | feedUrl | Competitor | Newest | Quality |
|---|---|---|---|---|
| Senior Housing News | https://seniorhousingnews.com/feed/ | **yes** (the US leader) | 17 Sep 2026 | full |
| Seniors Housing Business: finance | https://seniorshousingbusiness.com/category/finance/feed/ | **yes** (US deals title) | 15 Sep 2026 | full |
| NIC MAP (data) | https://www.nicmap.com/feed/ | no | 28 Aug 2026 | full; quarterly occupancy |
| Irving Levin Associates | https://www.levinassociates.com/feed/ | no | 18 Sep 2026 | summary; healthcare and seniors housing M&A |
| Argentum | https://www.argentum.org/feed/ | no | 17 Sep 2026 | summary; mostly member PR, low hit rate |

## No feed, but load-bearing: hub-only rows (newsrooms.js and outreach candidates)

Probed 18 Sep 2026. These are the sector's most important voices and almost
none of them publish a feed, as on every earlier title. The top block is where a
`lib/newsrooms.js` entry is worth an hour during the DNS wait.

| Name | Hub | Why no feed |
|---|---|---|
| **ARCO** | https://www.arcouk.org/news | Drupal 7; `/rss.xml` last item Nov 2021; `/feed` 404 |
| **Housing LIN** | https://www.housinglin.org.uk/News/ | no feed at any tried path |
| **Knight Frank research** | https://www.knightfrank.co.uk/research | no feed; the annual seniors housing reviews are scheduled data drops |
| Savills research | https://www.savills.co.uk/research_articles/ | 404 on feed paths |
| Law Commission | https://lawcom.gov.uk/ | WordPress feed valid but **empty** |
| McCarthy Stone | https://www.mccarthyandstone.co.uk/news/ | 403 to fetchers |
| Audley Group | https://www.audleyvillages.co.uk/news | Drupal, no feed |
| Inspired Villages | https://www.inspiredvillages.co.uk/news | no feed |
| Anchor | https://www.anchor.org.uk/news | Drupal 11, no feed |
| Housing 21 | https://www.housing21.org.uk/news/ | no feed |
| Churchill Retirement Living | https://www.churchillretirement.co.uk/news | no feed |
| Beechcroft | https://www.beechcroft.co.uk/news | no feed |
| Birchgrove | https://www.birchgrove.co.uk/news/ | WordPress feed valid but **empty** |
| Retirement Villages Group | https://www.retirementvillages.co.uk | no feed |
| Legal & General (Inspired, Guild Living) | https://group.legalandgeneral.com/en/newsroom | no feed |
| Lichfields | https://lichfields.uk/blog/ | no feed |
| Trowers & Hamlins | https://www.trowers.com/insights | no feed |
| Pinsent Masons Out-Law | https://www.pinsentmasons.com/out-law | no feed |
| HCR Law | https://www.hcrlaw.com/news/ | 403 |
| Care Home Professional | https://www.carehomeprofessional.com | 403 to fetchers (competitor, care-weighted) |
| Property Week (Later Living) | https://www.propertyweek.com | no feed, blocks fetchers (competitor) |
| Retirement Villages Association NZ | https://www.retirementvillages.org.nz/ | no feed |
| Te Ara Ahunga Ora Retirement Commission | https://retirement.govt.nz/ | 405 on feed paths |
| Ryman Healthcare | https://www.rymanhealthcare.co.nz | no feed; results via NZX |
| Summerset | https://www.summerset.co.nz | no feed |
| Oceania Healthcare | https://www.oceaniahealthcare.co.nz | no feed |
| Arvida | https://www.arvida.co.nz | no feed |
| Metlifecare | https://www.metlifecare.co.nz | no feed |
| Aveo | https://www.aveo.com.au | no feed |
| Stockland | https://www.stockland.com.au | no feed |
| Ingenia Communities | https://www.ingeniacommunities.com.au | 403 |
| GemLife | https://www.gemlife.com.au | 403 |
| Lifestyle Communities | https://www.lifestylecommunities.com.au | no feed |
| McKnight's Senior Living | https://www.mcknightsseniorliving.com | 403 (competitor) |
| Welltower | https://welltower.com | WordPress feed valid but empty; IR site refuses fetchers |

## Deliberately excluded

- **Care Home Magazine** (carehomemagazine.co.uk/feed/): CIM's own title. Outreach exclusion list, not the wire.
- **Skilled Nursing News**: US nursing homes, the other side of the front door.
- **Starts at 60, YourLifeChoices, Eldernet**: consumer titles. Resident-facing, the operator rule's contamination.
- **Elderly Accommodation Counsel** (housingcare.org/feed): valid but newest item Apr 2025.
- **Estates Gazette** `/feed/`: valid but newest item 2019.
