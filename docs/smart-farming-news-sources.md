# Smart Farming News: verified wire sources

Every feedUrl fetched and verified 18 Sep 2026 with a browser user-agent:
HTTP 200, valid RSS or Atom, item count and newest-item date recorded, and the
median body length of the first five items measured. **49 direct feeds**
against the playbook's 30+ target. Seeded by
`scripts/seed-smart-farming-news-sources.mjs` (49 feeds plus 54 hub-only
rows, 103 in all). feedUrls are known-good, so autodiscovery is skipped for
them.

**Ingester notes.**
- The gov.uk `.atom` feeds carry a one-line summary; the link resolves to the
  full page, which the fetcher reads (same as every earlier title).
- HMRC is seeded as a gov.uk search scoped to the word "agricultural", because
  the organisation feed is mostly unrelated forms. The first item on the day
  was Excise Notice 75 (rebated fuel), which is exactly the kind of item wanted.
- Energy-Storage.News and PV Tech return 150 items per fetch and are global.
  Expect most items to be non-UK; the Researcher should keep only UK
  land-lease, planning and grid items.
- The FT feed is headline-only and paywalled: a signal source, never a
  rewrite source.
- Innovate UK Business Connect's feed carries titles only (0 words of body).
- Berrys (land agent) mixes rural-business posts with planning consultations
  for unrelated clients; the owner rule filters those out.
- Glamping Business, AgFunderNews, Global AgTech Initiative and Agri Investor
  are global. Use them for deals and named UK companies, not for UK rules.

Body column: "full text" means the feed itself carries the article (200+
words); "summary" and "headline/summary" mean the fetcher must follow the link.

## Government, regulators and Parliament (19)

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| Defra | Policy & regulation | https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs.atom | 20 | 18 Sep 2026 | headline/summary (~17w) |
| Rural Payments Agency | Policy & regulation | https://www.gov.uk/government/organisations/rural-payments-agency.atom | 20 | 18 Sep 2026 | headline/summary (~22w) |
| Natural England | Natural capital | https://www.gov.uk/government/organisations/natural-england.atom | 20 | 17 Sep 2026 | headline/summary (~17w) |
| Environment Agency | Policy & regulation | https://www.gov.uk/government/organisations/environment-agency.atom | 20 | 18 Sep 2026 | headline/summary (~15w) |
| Forestry Commission | Natural capital | https://www.gov.uk/government/organisations/forestry-commission.atom | 20 | 18 Sep 2026 | headline/summary (~18w) |
| HMRC (agricultural) | Tax & succession | https://www.gov.uk/search/all.atom?organisations%5B%5D=hm-revenue-customs&keywords=agricultural | 10 | 18 Sep 2026 | headline/summary (~16w) |
| HM Treasury | Tax & succession | https://www.gov.uk/government/organisations/hm-treasury.atom | 20 | 18 Sep 2026 | headline/summary (~15w) |
| Dept for Energy Security & Net Zero | Energy & land use | https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero.atom | 20 | 18 Sep 2026 | headline/summary (~17w) |
| Ofgem | Energy & land use | https://www.ofgem.gov.uk/rss.xml | 4 | 18 Sep 2026 | headline/summary (~25w) |
| NESO | Energy & land use | https://www.neso.energy/rss.xml | 10 | 18 Sep 2026 | full text (~264w) |
| Great British Energy | Energy & land use | https://www.gov.uk/government/organisations/great-british-energy.atom | 20 | 14 Sep 2026 | headline/summary (~16w) |
| Innovate UK | Agtech & innovation | https://www.gov.uk/government/organisations/innovate-uk.atom | 20 | 1 Sep 2026 | headline/summary (~19w) |
| MHCLG | Planning | https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom | 20 | 17 Sep 2026 | headline/summary (~19w) |
| Valuation Office Agency | Tax & succession | https://www.gov.uk/government/organisations/valuation-office-agency.atom | 20 | 30 Jul 2026 | headline/summary (~13w) |
| Defra Farming blog | Policy & regulation | https://defrafarming.blog.gov.uk/feed/ | 10 | 16 Sep 2026 | full text (~613w) |
| Rural Payments blog | Policy & regulation | https://ruralpayments.blog.gov.uk/feed/ | 10 | 17 Sep 2026 | full text (~343w) |
| Natural England blog | Natural capital | https://naturalengland.blog.gov.uk/feed/ | 10 | 18 Sep 2026 | full text (~1005w) |
| House of Commons Library | Tax & succession | https://commonslibrary.parliament.uk/feed/ | 10 | 18 Sep 2026 | full text (~290w) |
| UKRI | Agtech & innovation | https://www.ukri.org/news/feed/ | 20 | 18 Sep 2026 | headline/summary (~27w) |

## Levy bodies, trade bodies, research and networks (9)

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| AHDB | Levy body & data | https://ahdb.org.uk/rss | 20 | 16 Sep 2026 | headline/summary (~9w) |
| Tenant Farmers Association | Trade body | https://www.tfa.org.uk/feed/ | 10 | 16 Sep 2026 | full text (~208w) |
| Agricultural Engineers Association | Trade body | https://aea.uk.com/feed/ | 10 | 7 Sep 2026 | summary (~71w) |
| Agri-TechE | Agtech & innovation | https://www.agri-tech-e.co.uk/feed/ | 12 | 18 Sep 2026 | summary (~57w) |
| Innovate UK Business Connect | Agtech & innovation | https://iuk-business-connect.org.uk/feed/ | 10 | 15 Sep 2026 | headline/summary (~0w) |
| Farm491 | Agtech & innovation | https://www.farm491.com/feed/ | 10 | 12 Aug 2026 | full text (~495w) |
| Royal Agricultural University | Research & education | https://www.rau.ac.uk/rss.xml | 10 | 18 Sep 2026 | summary (~88w) |
| Farm Carbon Toolkit | Natural capital | https://farmcarbontoolkit.org.uk/feed/ | 10 | 26 Aug 2026 | full text (~425w) |
| PASC UK (self-catering association) | Diversification | https://www.pascuk.co.uk/feed/ | 10 | 17 Sep 2026 | headline/summary (~21w) |

## Energy, planning and land-use press (8)

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| Energy-Storage.News | Energy & land use | https://www.energy-storage.news/feed/ | 150 | 18 Sep 2026 | headline/summary (~24w) |
| PV Tech | Energy & land use | https://www.pv-tech.org/feed/ | 150 | 18 Sep 2026 | headline/summary (~18w) |
| pv magazine | Energy & land use | https://www.pv-magazine.com/feed/ | 10 | 18 Sep 2026 | full text (~542w) |
| Planning Resource | Planning | https://www.planningresource.co.uk/rss/news | 20 | 18 Sep 2026 | headline/summary (~36w) |
| edie | Energy & land use | https://www.edie.net/feed/ | 12 | 18 Sep 2026 | headline/summary (~29w) |
| Energy Live News | Energy & land use | https://www.energylivenews.com/feed/ | 10 | 18 Sep 2026 | full text (~261w) |
| Glamping Business | Diversification | https://glampingbusiness.com/feed/ | 10 | 15 Sep 2026 | full text (~458w) |
| Lightsource bp UK | Energy developers | https://www.lightsourcebp.com/uk/feed/ | 10 | 23 Jul 2026 | full text (~656w) |

## Agtech, investment and finance press (3)

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| AgFunderNews | Agtech & investment | https://agfundernews.com/feed | 50 | 17 Sep 2026 | full text (~897w) |
| Global AgTech Initiative | Agtech & investment | https://www.globalagtechinitiative.com/feed/ | 10 | 16 Sep 2026 | summary (~41w) |
| Agri Investor | Agtech & investment | https://www.agriinvestor.com/feed/ | 10 | 18 Sep 2026 | headline/summary (~20w) |

## Sector press (6): all competitor-flagged, monitoring sources only

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| Future Farming | Sector press (competitor) | https://www.futurefarming.com/rss | 30 | 17 Sep 2026 | full text (~351w) |
| Farmers Guide | Sector press (competitor) | https://www.farmersguide.co.uk/feed/ | 10 | 18 Sep 2026 | full text (~524w) |
| Agriland UK | Sector press (competitor) | https://www.agriland.co.uk/feed/ | 80 | 18 Sep 2026 | full text (~496w) |
| The Scottish Farmer | Sector press (competitor) | https://www.thescottishfarmer.co.uk/news/rss/ | 50 | 19 Sep 2026 | headline/summary (~24w) |
| Profi | Sector press (competitor) | https://www.profi.co.uk/feed/ | 10 | 18 Sep 2026 | full text (~375w) |
| Farm Contractor and Large Scale Farmer | Sector press (competitor) | https://www.farmcontractormagazine.com/feed/ | 10 | 14 Sep 2026 | summary (~47w) |

Future Farming is the title that owns "smart farming" as agtech and is the
closest competitor to this masthead. Farmers Guide and Farm Contractor also
cover farm tech. None of these is an outreach target, and none of their copy is
rewritten without the underlying primary source.

## National press farming desks (2)

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| The Guardian: farming | National press | https://www.theguardian.com/environment/farming/rss | 20 | 18 Sep 2026 | summary (~129w) |
| Financial Times: agriculture | National press | https://www.ft.com/agriculture?format=rss | 25 | 17 Sep 2026 | headline/summary (~13w) |

## Suppliers and advisers with feeds (2)

| Name | Category | feedUrl | Items | Newest | Body |
|---|---|---|---|---|---|
| Hutchinsons | Agronomy & inputs | https://www.hutchinsons.co.uk/feed/ | 10 | 18 Sep 2026 | summary (~48w) |
| Berrys | Land agents | https://www.berrys.uk.com/feed/ | 10 | 1 Sep 2026 | full text (~501w) |

## Tech vs land-business coverage of the feeds

| Half of the angle | Feeds |
|---|---|
| Tech (Farm Tech, Software & Data) | Innovate UK, UKRI, Agri-TechE, IUK Business Connect, Farm491, RAU, AEA, AgFunderNews, Global AgTech Initiative, Future Farming, Profi, Farm Contractor, Hutchinsons, AHDB |
| Land-business (Energy & Land Use, Natural Capital, Diversification, Land, Tax & Succession) | Natural England and its blog, Forestry Commission, DESNZ, Ofgem, NESO, Great British Energy, MHCLG, VOA, HMRC (agricultural), HM Treasury, Commons Library, TFA, Farm Carbon Toolkit, PASC UK, Energy-Storage.News, PV Tech, pv magazine, Planning Resource, edie, Energy Live News, Glamping Business, Lightsource bp, Agri Investor, Berrys |
| Both / general | Defra, RPA and its blog, Environment Agency, Defra Farming blog, Farmers Guide, Agriland UK, The Scottish Farmer, Guardian, FT |

The land-business half is the better-fed one. Tech feeds are plentiful
globally but thin on UK payback data, which is why the tech half leans on the
Google News wire (see the launch tracker) and on the content plan.

## Probed and rejected (18 Sep 2026)

No feed at any usual path: Farmers Weekly, Farmers Guardian, FarmingUK, Farm
Diversity, NFU, CLA, Soil Association, NFFN, Harper Adams, Savills, Strutt &
Parker, Carter Jonas, Knight Frank, Stags, Cheffins, Thrings, Oxbury, NFU
Mutual, Canopy & Stars, Farm Business Innovation Show, LAMMA, Groundswell,
Welsh Government, Scottish Government.

Blocked (403) or unreachable from a script: Solar Energy UK, CAAV, FARMA,
BHHPA, IAgrM, Renews, Environmental Finance, BusinessGreen, The Robot Report,
Rural Services Network, Agri-EPI Centre, Tech Farmer, LandBNG, Gatekeeper,
Farm Stay UK, Island Green Power, Roythornes, Wilsons.

Empty or HTML instead of a feed: UKRI root `/feed/` (the `/news/feed/` path
works), UK Agri-Tech Centre, NIAB, Current±, Solar Power Portal, Anesco, EFG,
Brown & Co, AMC, Community Energy England, SOYL, RASE, Cereals.

Stale: Rothamsted (Nov 2022), NAAC (Sep 2022), Herdwatch (Jan 2026), Defra
press office blog (Jan 2026), Farming Monthly (Mar 2026), Environment Bank and
CPRE (placeholder posts only).

Relevance too loose to seed: gov.uk keyword searches for "farmers",
"agricultural property relief" and "Sustainable Farming Incentive" all return
the same undifferentiated gov.uk news stream (the keyword is not applied as a
filter on that endpoint). The organisation-scoped search used for HMRC does
filter and is the one seeded. Planning Inspectorate's feed is dominated by
unrelated S62A applications. Sykes Cottages' blog is consumer travel.
PrecisionAg duplicates Global AgTech Initiative (same publisher).

Hub-only rows (54) are in the seed script: every one is an advertiser, adviser
or outreach target from the brief's §7 map, and autodiscovery gets a second
chance at each.
