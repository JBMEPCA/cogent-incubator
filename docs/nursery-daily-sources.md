# Nursery Daily: verified wire sources

Every feedUrl below was fetched on 18 Sep 2026 with a browser user-agent and
confirmed to return valid RSS or Atom with items; the newest-item date is
recorded. **52 direct feeds are seeded** against the playbook's 30+ target, plus
6 further verified feeds deliberately held back as hub-only (reasons below).
`scripts/seed-nursery-daily-sources.mjs` carries exactly the seeded set.

The brief (`docs/vertical-brief-nurseries.md` §5) measured about 2.3
sector-grade wire items a day from Google News alone. That is why this list is
weighted to gov.uk: the Ofsted and DfE Atom feeds, plus nine gov.uk keyword
and topic searches, are guaranteed, full-text and not Google-dependent. They
are also where group-level enforcement arrives from an official source, which
is the only way the safeguarding rule lets us cover it.

**Ingester notes.** gov.uk search feeds (`/search/*.atom?keywords=`) match
loosely: the "childcare" news feed also returns unrelated ministerial speeches.
That is noise the Researcher discards, not a broken feed. Famly's feed returns
100 items per fetch; dedupe on link. Business Live, Growth Business, Lester
Aldridge and SHMA are general business or law feeds that carry nursery deals
and employment-law items a few times a month; expect a low hit rate and treat
them as deal and compliance catchment, not beat feeds.

## Policy, regulators and government (26)

| Name | feedUrl | Newest |
|---|---|---|
| Ofsted | https://www.gov.uk/government/organisations/ofsted.atom | 18 Sep 2026 |
| Dept for Education | https://www.gov.uk/government/organisations/department-for-education.atom | 18 Sep 2026 |
| HMRC | https://www.gov.uk/government/organisations/hm-revenue-customs.atom | 18 Sep 2026 |
| HM Treasury | https://www.gov.uk/government/organisations/hm-treasury.atom | 18 Sep 2026 |
| Dept for Business and Trade | https://www.gov.uk/government/organisations/department-for-business-and-trade.atom | 18 Sep 2026 |
| Companies House | https://www.gov.uk/government/organisations/companies-house.atom | 17 Sep 2026 |
| Insolvency Service | https://www.gov.uk/government/organisations/insolvency-service.atom | 18 Sep 2026 |
| Low Pay Commission | https://www.gov.uk/government/organisations/low-pay-commission.atom | 1 Sep 2026 |
| Valuation Office Agency | https://www.gov.uk/government/organisations/valuation-office-agency.atom | 30 Jul 2026 |
| Skills England | https://www.gov.uk/government/organisations/skills-england.atom | 27 Aug 2026 |
| Competition and Markets Authority | https://www.gov.uk/government/organisations/competition-and-markets-authority.atom | 18 Sep 2026 |
| HSE press | https://press.hse.gov.uk/feed/ | 17 Sep 2026 |
| gov.uk news: childcare | https://www.gov.uk/search/news-and-communications.atom?keywords=childcare | 17 Sep 2026 |
| gov.uk news: early years | https://www.gov.uk/search/news-and-communications.atom?keywords=%22early+years%22 | 15 Sep 2026 |
| gov.uk news: nurseries | https://www.gov.uk/search/news-and-communications.atom?keywords=nurseries | 15 Sep 2026 |
| gov.uk statistics: childcare | https://www.gov.uk/search/research-and-statistics.atom?keywords=childcare | 17 Sep 2026 |
| gov.uk guidance: early years | https://www.gov.uk/search/guidance-and-regulation.atom?keywords=%22early+years%22 | 18 Sep 2026 |
| gov.uk policy and consultations: childcare | https://www.gov.uk/search/policy-papers-and-consultations.atom?keywords=childcare | 26 Aug 2026 |
| gov.uk all: Ofsted early years | https://www.gov.uk/search/all.atom?keywords=%22early+years%22&organisations%5B%5D=ofsted&order=updated-newest | 18 Sep 2026 |
| gov.uk all: DfE early years | https://www.gov.uk/search/all.atom?keywords=%22early+years%22&organisations%5B%5D=department-for-education&order=updated-newest | 17 Sep 2026 |
| gov.uk all: wraparound childcare | https://www.gov.uk/search/all.atom?keywords=wraparound+childcare&order=updated-newest | 18 Sep 2026 |
| Ofsted early years blog | https://earlyyears.blog.gov.uk/feed/ | 19 Aug 2026 |
| Ofsted education inspection blog | https://educationinspection.blog.gov.uk/feed/ | 26 Aug 2026 |
| Welsh Government announcements | https://www.gov.wales/announcements/rss | 18 Sep 2026 |
| NI Dept of Education | https://www.education-ni.gov.uk/news/feed/education | 15 Sep 2026 |
| House of Commons Library | https://commonslibrary.parliament.uk/feed/ | 18 Sep 2026 |

The Bright Horizons regulatory update of 15 Sep 2026 arrived on three of these
feeds (Ofsted, gov.uk news: early years, gov.uk news: nurseries). That is the
safeguarding rule's preferred shape: an official, group-level notice.

## Associations, research and data (11)

| Name | feedUrl | Newest |
|---|---|---|
| NDNA | https://ndna.org.uk/feed/ | 15 Sep 2026 |
| Coram PACEY | https://www.corampacey.org.uk/feed/ | 17 Sep 2026 |
| Early Education | https://early-education.org.uk/feed/ | 17 Sep 2026 |
| Early Years Scotland | https://earlyyearsscotland.org/feed/ | 4 Sep 2026 |
| Foundation Years (DfE-funded sector info) | https://www.foundationyears.org.uk/feed/ | 15 Sep 2026 |
| Early Childhood Ireland | https://www.earlychildhoodireland.ie/feed/ | 15 Sep 2026 |
| Pobal (Ireland, childcare funding administrator) | https://www.pobal.ie/feed/ | 11 Sep 2026 |
| Resolution Foundation | https://www.resolutionfoundation.org/feed/ | 16 Sep 2026 |
| Sutton Trust | https://www.suttontrust.com/feed/ | 9 Sep 2026 |
| Nuffield Foundation | https://www.nuffieldfoundation.org/feed | 16 Sep 2026 |
| British Chambers of Commerce | https://www.britishchambers.org.uk/feed/ | 17 Sep 2026 |

The two Irish feeds are seeded although `markets` is `["GB"]`: the brief
recommends UK and Ireland at launch, and Ireland's pay and funding story is
live. Drop them if JB rules Ireland out.

## Business, deal wires and sector-adjacent press (4)

| Name | feedUrl | Competitor | Newest |
|---|---|---|---|
| Business Live (Reach) | https://www.business-live.co.uk/?service=rss | no | 18 Sep 2026 |
| Business Sale Report | https://www.business-sale.com/news/rss | no | 18 Sep 2026 |
| Growth Business | https://growthbusiness.co.uk/feed/ | no | 18 Sep 2026 |
| Local Government Chronicle | https://www.lgcplus.com/feed/ | no | 18 Sep 2026 |

Business Sale Report and Business Live between them carried five of the
nursery deals the brief's 30-day deal search found (Kids Planet, Granby,
Fremman). LGC is the council-finance feed: LA funding and council nursery
closures.

## Suppliers and software (8)

| Name | feedUrl | Newest |
|---|---|---|
| Famly | https://www.famly.co/blog/rss.xml | 18 Sep 2026 |
| Parenta | https://www.parenta.com/feed/ | 18 Sep 2026 |
| Tapestry | https://tapestry.info/feed/ | 10 Jul 2026 |
| Connect Childcare | https://connectchildcare.com/feed/ | 18 Sep 2026 |
| Kinderly | https://kinderly.co.uk/feed/ | 26 Aug 2026 |
| Ovivio UK | https://ovivio.com/uk/feed/ | 15 Sep 2026 |
| Nursery Kitchen | https://nurserykitchen.co.uk/feed/ | 18 Sep 2026 |
| Early Excellence | https://earlyexcellence.com/feed/ | 14 Aug 2026 |

blossomeducational.com's feed autodiscovery points at ovivio.com/uk, which
suggests Blossom now trades as or under Ovivio *(unverified; check before
naming the relationship in copy)*.

## Brokers and law firms (3)

| Name | feedUrl | Newest |
|---|---|---|
| Owen Froebel | https://owenfroebel.co.uk/feed/ | 3 Aug 2026 |
| SHMA (Shakespeare Martineau) | https://www.shma.co.uk/feed/ | 18 Sep 2026 |
| Lester Aldridge | https://www.lesteraldridge.com/feed/ | 17 Sep 2026 |

## Verified but held back as hub-only (6)

These feeds work. They are not seeded as feeds because what they carry is
parent-facing or practitioner content, and the buyer rule would reject most of
it; seeding them would fill the wire with items that cost a Researcher pass to
throw away. They are seeded as hub rows (outreach and advertiser targets).

| Name | feedUrl | Why held back |
|---|---|---|
| Kids Planet | https://www.kidsplanetdaynurseries.co.uk/feed/ | Parent advice (safe sleep, feelings); deals come via the wires |
| GrandirUK | https://www.grandiruk.com/feed/ | Employer-brand and parent content |
| Monkey Puzzle Day Nurseries | https://monkeypuzzledaynurseries.com/feed/ | Parent webinars |
| High Speed Training | https://www.highspeedtraining.co.uk/hub/feed/ | Content farm; holds the "how to open a nursery" SERP we are attacking |
| Cheqdin | https://cheqdin.com/feed | Stale (Dec 2023) |
| DfE Education Hub | https://educationhub.blog.gov.uk/feed/ | Written for parents ("what parents need to know") |

Also verified and rejected as stale: Coram (Feb 2025), Social Mobility
Commission (Dec 2025), Children in Scotland (Oct 2025), Your Nursery Business
(Apr 2023), Annabel Karmel (Feb 2026, and consumer).

## Competitors (monitoring only, no feed available)

None of the sector's publications could be read as a feed on 18 Sep 2026, so
they are seeded hub-only with category `Sector press (competitor)`.

| Publication | Result |
|---|---|
| Nursery World (MA Education) | 403 to every fetch, `/rss` and `/feed` |
| Nursery Management Today (Nexus Media) | Returns HTML at `/feed/` and `/news/feed/`; no feed |
| CYP Now | 403 |
| Teach Early Years | 404 |
| Early Years Educator | Journal platform; not probed further |
| daynurseries.co.uk | Parent review site; runs operator-facing ratio advice and a jobs board. No feed |
| The Sector (Australia) | No feed found; reference title, not a UK competitor |

## No feed found (hub-only, advertiser and outreach targets)

Probed 18 Sep 2026: Early Years Alliance (403 site-wide), IFS (403), LGA (403),
NCB (403), NFER (404), EPI (feed empty), Montessori Group (521), Care
Inspectorate, Scottish Government news, Early Years Wales, Mudiad Meithrin
(feed empty), Employers for Childcare NI (feed empty), Christie & Co, Christie
Finance, Savills, Insider Media, TheBusinessDesk (304 with no body), Abacus
Day Nursery Sales, Eclipse Corporate Finance, Redwoods Dowling Kerr, LaingBuisson,
Stephensons, Busy Bees, Bright Horizons UK, Storal, Bright Stars, Morton Michel,
Community Playthings, Hope Education, YPO, Zebedees, Apetito, Cosy, Funding
Loop, Tickit, Childcare Marketing, JBD Recruitment, Eden Training Solutions,
Nursery in a Box, childcare.co.uk.

**The biggest gap is the deal desk.** Christie & Co, Insider Media and
TheBusinessDesk are the brief's three named deal sources and none has a
readable feed; their deals reach us through Business Sale Report, Business Live
and the acquisitions search. They are the first newsrooms to hand-verify during
the DNS wait.

## Google News

Google News queries are supplementary only; the proposed set, with measured
7-day yields, is in `docs/nursery-daily-launch.md`.
