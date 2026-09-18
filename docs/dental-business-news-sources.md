# Dental Business News: verified wire sources

Every feedUrl below was fetched on 18 Sep 2026 and returned valid RSS or Atom
with items; newest-item date and median item body length (words in the feed
itself, before the ingester fetches the page) recorded. **53 direct feeds**
against the playbook's 30+ target, plus 39 hub-only rows that have no working
feed but earn their place as outreach, advertiser and autodiscovery targets.
The seed is `scripts/seed-dental-business-news-sources.mjs`; the feedUrls are
known-good, so skip autodiscovery for them.

**Ingester notes.**

- gov.uk atoms carry a ~20-word summary; the linked page is the full release.
  Same shape as every other title's gov.uk rows.
- `nature.com` feeds bounce first-time requests through a cookie redirect. The
  BDJ feed survived it on every probe; BDJ In Practice did once and failed
  twice, so it is hub-only.
- The two gov.uk keyword wires (`dental` news and statistics) are relevance
  searches and noisy: of 20 items, roughly a third are dental. They earn their
  place because they caught "Dental Earnings and Expenses 2024/25" and the NI
  GDS statistics release, which no other row did. Do not add the gov.uk `all`
  search: it surfaces employment tribunal decisions naming individual dentists,
  which the fitness-to-practise rule keeps out.
- Healthwatch England publishes no dates in its feed: dedupe on link.
- Scottish Dental Show's feed carries 247 items going back years: the scan
  must take only the newest.

## NHS, government and regulators (16)

| Name | feedUrl | Newest | Median words |
|---|---|---|---|
| DHSC | https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom | 17 Sep 2026 | summary, then full |
| NHS England (gov.uk) | https://www.gov.uk/government/organisations/nhs-england.atom | 17 Sep 2026 | 20, then full |
| NHS England news | https://www.england.nhs.uk/news/feed/ | 9 Sep 2026 | 56 |
| NHSBSA (gov.uk) | https://www.gov.uk/government/organisations/nhs-business-services-authority.atom | 31 Aug 2026 | summary, then full |
| gov.uk statistics wire "dental" | https://www.gov.uk/search/research-and-statistics.atom?keywords=dental&order=updated-newest | 20 Aug 2026 | summary (noisy, see above) |
| gov.uk news wire "dental" | https://www.gov.uk/search/news-and-communications.atom?keywords=dental&order=updated-newest | 3 Sep 2026 | summary (noisy) |
| CQC (gov.uk) | https://www.gov.uk/government/organisations/care-quality-commission.atom | 14 Sep 2026 | summary, then full |
| DDRB | https://www.gov.uk/government/organisations/review-body-on-doctors-and-dentists-remuneration.atom | 19 Aug 2026 | summary, then full |
| MHRA | https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom | 18 Sep 2026 | summary, then full |
| CMA | https://www.gov.uk/government/organisations/competition-and-markets-authority.atom | 18 Sep 2026 | summary, then full (dental merger reviews land here) |
| Welsh Government | https://www.gov.wales/announcements/rss | 18 Sep 2026 | summary (100 items, all topics) |
| Dept of Health NI | https://www.health-ni.gov.uk/rss.xml | 16 Sep 2026 | 94 |
| RQIA | https://www.rqia.org.uk/feed/ | 15 Sep 2026 | 311 |
| Healthcare Improvement Scotland | https://www.healthcareimprovementscotland.scot/feed/ | 17 Sep 2026 | 13 |
| Healthwatch England | https://www.healthwatch.co.uk/rss.xml | undated (current) | 27 |
| House of Commons Library | https://commonslibrary.parliament.uk/feed/ | 18 Sep 2026 | 332 |

## Tax, business, finance and immigration (11)

| Name | feedUrl | Newest | Median words |
|---|---|---|---|
| HMRC | https://www.gov.uk/government/organisations/hm-revenue-customs.atom | 18 Sep 2026 | summary, then full |
| HM Treasury | https://www.gov.uk/government/organisations/hm-treasury.atom | 18 Sep 2026 | summary, then full |
| Companies House | https://www.gov.uk/government/organisations/companies-house.atom | 17 Sep 2026 | summary, then full |
| Insolvency Service | https://www.gov.uk/government/organisations/insolvency-service.atom | 18 Sep 2026 | summary, then full |
| Dept for Business and Trade | https://www.gov.uk/government/organisations/department-for-business-and-trade.atom | 18 Sep 2026 | summary, then full |
| British Business Bank | https://www.gov.uk/government/organisations/british-business-bank.atom | 4 Sep 2026 | summary, then full |
| Bank of England | https://www.bankofengland.co.uk/rss/news | 18 Sep 2026 | summary (50 items) |
| Home Office | https://www.gov.uk/government/organisations/home-office.atom | 18 Sep 2026 | summary, then full (quarterly visa statistics) |
| UK Visas and Immigration | https://www.gov.uk/government/organisations/uk-visas-and-immigration.atom | 18 Sep 2026 | summary, then full |
| Low Pay Commission | https://www.gov.uk/government/organisations/low-pay-commission.atom | 1 Sep 2026 | summary, then full |
| Skills England | https://www.gov.uk/government/organisations/skills-england.atom | 27 Aug 2026 | summary, then full |

## Trade bodies and professional associations (9)

| Name | feedUrl | Newest | Median words |
|---|---|---|---|
| Association of Dental Groups | https://www.theadg.co.uk/feed/ | 18 Sep 2026 | 97 |
| BDIA | https://bdia.org.uk/feed/ | 4 Sep 2026 | 396 |
| ADAM (practice managers) | https://www.adam-aspire.co.uk/feed/ | 15 Sep 2026 | 301 |
| NASDAL | https://nasdal.org.uk/feed/ | 8 Sep 2026 | 531 (goodwill survey, benchmarking) |
| College of General Dentistry | https://cgdent.uk/feed/ | 17 Sep 2026 | 25 |
| BSDHT | https://www.bsdht.org.uk/feed/ | 6 May 2026, slow, watch staleness | 414 |
| Dental Laboratories Association | https://dla.org.uk/feed/ | 3 Sep 2026 | 77 |
| Council of European Dentists | https://www.cedentists.eu/feed/ | 17 Sep 2026 | 43 |
| FDI World Dental Federation | https://www.fdiworlddental.org/rss.xml | 18 Sep 2026 | 484 |

## Sector and market press (7): competitor-flagged rows are monitoring sources

| Name | feedUrl | Competitor | Newest | Median words |
|---|---|---|---|---|
| Dentistry.co.uk (FMC) | https://dentistry.co.uk/feed/ | **yes, the incumbent** | 18 Sep 2026 | 417 |
| The Probe (Purple Media) | https://the-probe.co.uk/feed/ | **yes** | 18 Sep 2026 | 521 |
| Scottish Dental magazine | https://www.sdmag.co.uk/feed/ | **yes** | 17 Sep 2026 | 36 |
| British Dental Journal (BDA) | https://www.nature.com/bdj.rss | **yes** (member title) | 11 Sep 2026 | 14 |
| Dental Group Signal (Substack) | https://dentalgroupsignal.substack.com/feed | **yes, on our seam** | 18 Sep 2026 | 1,133 (full text; the only wire for UK group deals) |
| Group Dentistry Now | https://www.groupdentistrynow.com/feed/ | no (US DSO market) | 18 Sep 2026 | 1,574 |
| LaingBuisson News | https://www.laingbuissonnews.com/feed/ | no (market data) | 18 Sep 2026 | 14 |

## Deal advisers, accountants and lawyers (4)

| Name | feedUrl | Newest | Median words |
|---|---|---|---|
| PFM Dental | https://pfmdental.co.uk/feed/ | 17 Sep 2026 | 780 |
| DJH | https://www.djh.co.uk/feed/ | 15 Sep 2026 | 1,287 |
| Scott Bailey | https://www.scottbailey.co.uk/feed | 17 Sep 2026 | 1,298 |
| Blake Morgan | https://www.blakemorgan.co.uk/feed/ | 15 Sep 2026 | 21 (whole firm, healthcare is a slice) |

## Plans, finance, compliance, fit-out, insurance, events (6)

| Name | feedUrl | Newest | Median words |
|---|---|---|---|
| Practice Plan | https://www.practiceplan.co.uk/feed/ | 18 Sep 2026 | 770 |
| Medenta | https://www.medenta.com/feed/ | 28 Aug 2026 | 1,203 |
| Agilio Software | https://agiliosoftware.com/feed/ | 14 Sep 2026 | 898 |
| Anglian Dental | https://angliandental.co.uk/feed/ | 17 Sep 2026 | 57 |
| Dentists' Provident | https://www.dentistsprovident.co.uk/feed | 12 Jun 2026, slow | 440 |
| Scottish Dental Show | https://sdshow.co.uk/feed/ | 17 Jul 2026 | 45 |

## No working feed: do not waste time re-probing

GDC (no feed on any news path), CQC's own site, NHSBSA's own site (rss.xml
returns an empty 200), BDA (403 to every path), BADN, Scottish Government,
Public Health Scotland, HIW, NHS Wales, Christie & Co, Frank Taylor &
Associates, Samera, Humphrey & Co, Hodsons, Hempsons, Thorntons (403), Denplan,
Patient Plan Direct, Tabeo, Kandoo, Braemar Finance (401), Wesleyan, Dojo (403),
Software of Excellence, Dentally, Clero, Carestream Dental, Henry Schein (UK
404, IR 403), Straumann (403), Envista IR (empty), Planmeca, Belmont, Dental
Protection, DDU, MDDUS (403), Radar Healthcare (403), mydentist, Bupa,
PortmanDentex, Rodericks, Colosseum Dental, the Dentistry Show sites, BDIA
Dental Showcase, BACD, Save Face, JCCP, The Dentist (403), Dental Review,
Dental Practice Owner (site and beehiiv), Dental Nursing (403), Private
Dentistry, King's Fund (403), Nuffield Trust, Health Foundation, NHS
Confederation (401), ASA, LGA (403).

Intermittent: **Dental Elite** returned 12 items once, then 403 twice.
**BDJ In Practice** returned 8 items once, then cookie-redirected twice. Both
are hub-only rows; re-probe after launch.

Stale or dead: Dental Tribune UK and international (one "test" item from Jan
2021), Dental Products Report (Dec 2024), NHS England statistics feed (Aug
2025), Swoop (2020).

Not seeded, on purpose: Dentistry Today and DentistryIQ (US clinical CE
promotion), Barcan Kirby (general practice law firm, no dental content in the
sample), OHID (patient oral-health material), Dental Schools Council (one item
in six months).

## What the direct feeds still cannot see

The four seam topics, measured against this list:

| Seam | Wire supply | Where it comes from instead |
|---|---|---|
| UK practice sales and group deals | Dental Group Signal only, plus the odd CMA merger notice | The deals tracker: Companies House filings, Christie & Co and broker "sold" pages, group press releases |
| NHS contract values and handbacks | NHS England, NHSBSA and local press via Google News | NHSBSA open data (contract values by practice and ICB) |
| Practice openings and closures | Local press via Google News, 1 to 3 a week | CQC registrations and deregistrations |
| Private conversion | Local press via Google News | NHSBSA contract data year on year, plus local press |
