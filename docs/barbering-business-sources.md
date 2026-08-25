# Barbering Business — verified wire sources

Every feedUrl fetched and verified 21 Aug 2026 (valid RSS/Atom, newest-item
date recorded, article quality spot-checked). 44 direct feeds against the
playbook's 30+ target. Seed these into the sources script at build time —
feedUrls are known-good, skip autodiscovery.

**Ingester notes:** Professional Beauty and HJ publish feeds with no pubDate —
dedupe on GUID/link, not date. The seven Shopify `.atom` feeds (brand/wholesale
rows) carry full HTML bodies in `<content>`.

## Policy / trade bodies / regulators (18)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| NHBF news | https://www.nhbf.co.uk/news-and-blogs/news/feed.xml | 14 Aug 2026 | summary → full (~900w) |
| British Beauty Council | https://britishbeautycouncil.com/feed/ | 8 Jun 2026 | full |
| Hair & Barber Council | https://www.haircouncil.org.uk/feed/ | 22 Jul 2026 | summary |
| HABIA | https://www.habia.org/feed/ | 19 Jun 2026 | full |
| VTCT | https://www.vtct.org.uk/feed/ | 20 Aug 2026 | full |
| HMRC | https://www.gov.uk/government/organisations/hm-revenue-customs.atom | 21 Aug 2026 | summary → full |
| HM Treasury | https://www.gov.uk/government/organisations/hm-treasury.atom | 21 Aug 2026 | summary → full |
| Dept for Business & Trade | https://www.gov.uk/government/organisations/department-for-business-and-trade.atom | 21 Aug 2026 | summary → full |
| Companies House | https://www.gov.uk/government/organisations/companies-house.atom | 20 Aug 2026 | summary → full |
| Insolvency Service | https://www.gov.uk/government/organisations/insolvency-service.atom | 21 Aug 2026 | summary → full |
| Low Pay Commission | https://www.gov.uk/government/organisations/low-pay-commission.atom | 18 Aug 2026 | summary → full |
| Valuation Office Agency | https://www.gov.uk/government/organisations/valuation-office-agency.atom | 30 Jul 2026 | summary → full |
| Skills England | https://www.gov.uk/government/organisations/skills-england.atom | 5 Aug 2026 | summary → full |
| Dept for Education | https://www.gov.uk/government/organisations/department-for-education.atom | 20 Aug 2026 | summary → full |
| NCA (gov.uk) | https://www.gov.uk/government/organisations/national-crime-agency.atom | 20 Aug 2026 | summary → full |
| NCA newsroom | https://www.nationalcrimeagency.gov.uk/news?format=feed&type=rss | 19 Aug 2026 | summary → full |
| gov.uk keyword wire "barbers" | https://www.gov.uk/search/news-and-communications.atom?keywords=barbers | 11 Aug 2026 | summary → full (direct links) |
| British Chambers of Commerce | https://www.britishchambers.org.uk/feed/ | 19 Aug 2026 | full |

## Sector & market press (11) — competitor-flagged rows are monitoring sources

| Name | feedUrl | Competitor | Newest | Quality |
|---|---|---|---|---|
| BarberEVO | https://barberevo.com/feed/ | **yes** | 17 Aug 2026 | full |
| Professional Beauty | https://www.professionalbeauty.co.uk/rss | **yes** | undated (current) | summary |
| HJ | https://www.hji.co.uk/rss | **yes** | undated (current) | summary |
| Scratch | https://www.scratchmagazine.co.uk/feed/ | **yes** | 20 Aug 2026 | summary |
| Salon Business | https://salonbusiness.co.uk/feed/ | **yes** | 21 Aug 2026 | summary |
| Estetica | https://www.esteticamagazine.com/feed/ | **yes** | 20 Aug 2026 | full |
| TheIndustry.beauty | https://theindustry.beauty/feed/ | **yes** | 21 Aug 2026 | summary |
| Cosmetics Business | https://www.cosmeticsbusiness.com/rss | no | 21 Aug 2026 | headline/summary |
| GCI Magazine | https://www.gcimagazine.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D | no | 20 Aug 2026 | headline-only |
| Mintel press centre | https://www.mintel.com/press-centre/feed/ | no | 5 Aug 2026 | full |
| SmallBusiness.co.uk | https://smallbusiness.co.uk/feed/ | no | 20 Aug 2026 | full |

## Brand newsrooms (7)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| Reuzel | https://reuzel.com/blogs/news.atom | 18 Aug 2026 | full |
| The Bluebeards Revenge | https://www.bluebeards-revenge.co.uk/blogs/blog.atom | 7 Aug 2026 | full (`news.atom` on this store is empty — use blog.atom) |
| Uppercut Deluxe | https://uppercutdeluxe.com/blogs/blog.atom | 11 Aug 2026 | full |
| Captain Fawcett | https://captainfawcett.com/blogs/the-captains-journal.atom | 11 Aug 2026 | full |
| StyleCraft (covers Gamma+) | https://stylecraftus.com/blogs/posts.atom | 20 Aug 2026 | full |
| Denman | https://denmanbrush.com/blogs/news.atom | 23 Jun 2026 | full |
| REM UK | https://www.rem.co.uk/feed/ | 13 Jul 2026 | full |

## Wholesale (1), software/services (5), high-street data (1)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| Barber Temple | https://barbertemple.co.uk/blogs/news.atom | 17 Aug 2026 | full (barberblades.co.uk serves the identical feed — do not seed both) |
| Phorest | https://www.phorest.com/blog/feed/ | 14 Aug 2026 | full |
| Treatwell (Treatment Files) | https://www.treatwell.co.uk/treatment-files/feed/ | 20 Aug 2026 | full |
| TiPJAR | https://wearetipjar.com/feed/ | 20 Apr 2026 — slow, watch staleness | full |
| Salon Gold | https://www.salongold.co.uk/blog/feed/ | 18 Aug 2026 | summary |
| Simply Business | https://www.simplybusiness.co.uk/feed/ | 19 Aug 2026 | full |
| Green Street EU (ex-LDC) | https://eu.greenstreet.com/feed/ | 20 Aug 2026 | full |

## No feed exists — do not waste time re-probing

Modern Barber, Creative HEAD, Wahl (all properties), Andis, BaByliss Pro UK,
Gamma+ NA (use StyleCraft), Takara Belmont, Salons Direct, Coolblades, Capital
Hair & Beauty, Booksy, Fresha, Squire, Vagaro (403), Nearcut, SumUp, Square
UK, Zettle, Dojo, EasyTip, FSB, BRC, PwC press, BeautyMatter, Barber Connect,
Salon International, Great British Barber Bash (event coverage arrives via HJ
and Professional Beauty feeds instead). Stale/empty: JRL (0 entries), American
Crew (Oct 2025), Slick Gorilla (May 2025), MRI Software (0 items),
CosmeticsDesign-Europe (410 Gone).

## Google News fallback queries (supplementary ONLY — never primary wire)

1. `"barbershop" business UK`
2. `NHBF OR "National Hair and Beauty Federation"`
3. `barber apprenticeship UK`
4. `"Operation Machinize" OR barbershop "money laundering"`
5. `men's grooming brand launch`
6. `barbershop opening high street UK`
7. `Wahl OR Andis OR BaByliss clippers business`
8. `salon booking app funding`
