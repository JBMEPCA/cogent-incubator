# Airport Business Magazine — verified wire sources

Every feedUrl fetched and verified 24 Aug 2026 (valid RSS/Atom, newest-item
date recorded, article quality spot-checked). **48 direct feeds** against the
playbook's 30+ target. Seed via `scripts/seed-airport-sources.mjs` —
feedUrls are known-good, skip autodiscovery.

**Ingester notes:** the AviationPros feedUrl contains a URL-encoded JSON query
param — store it exactly as written. Kansai Airports items are title-only (no
description) — dedupe on GUID, fetch body from link. ACI Europe is a Joomla
feed carrying full press text inside `<description>`; Leidos, US DOT and Port
of Seattle also carry full release text in `<description>` (no
`content:encoded`). The four gov.uk feeds are Atom, all others RSS 2.0.

## Policy / trade bodies / regulators / data (16)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| ACI World | https://aci.aero/feed/ | 28 Jul 2026 | full |
| ACI World Insights blog | https://blog.aci.aero/feed/ | 6 Aug 2026 | full |
| ACI Europe | https://www.aci-europe.org/media-room.html?format=feed&type=rss | 30 Jul 2026 | full (press text in description) |
| ACI-NA | https://airportscouncil.org/feed/ | 15 Jul 2026 | full |
| AirportsUK (ex-AOA — aoa.org.uk redirects here) | https://airportsuk.org/feed/ | 4 Aug 2026 | full (short posts) |
| IATA pressroom | https://www.iata.org/api/rss/pressrelease | 20 Aug 2026 | summary → full |
| EASA news | https://www.easa.europa.eu/en/newsroom-and-events/news/feed.xml | 19 Aug 2026 | summary → full |
| CANSO | https://canso.org/feed/ | 11 Aug 2026 | full |
| FAA newsroom | https://www.faa.gov/rss.xml | 21 Jul 2026 | summary → full |
| US DOT | https://www.transportation.gov/rss.xml | 18 Aug 2026 | full (in description) |
| UK Dept for Transport | https://www.gov.uk/government/organisations/department-for-transport.atom | 21 Aug 2026 | summary → full |
| UK CAA (gov.uk org page) | https://www.gov.uk/government/organisations/civil-aviation-authority.atom | 10 Aug 2026 | summary → full |
| gov.uk wire: "airport" | https://www.gov.uk/search/news-and-communications.atom?keywords=airport | 19 Aug 2026 | summary → full |
| gov.uk wire: "aviation" | https://www.gov.uk/search/news-and-communications.atom?keywords=aviation | 14 Aug 2026 | summary → full |
| OAG blog | https://www.oag.com/blog/rss.xml | 20 Aug 2026 | full |
| Skytrax / World Airport Awards | https://www.worldairportawards.com/feed/ | 18 Mar 2026 | summary → full (low volume, annual cycle) |

## Trade & construction press (18) — competitor-flagged rows are monitoring sources

| Name | feedUrl | Competitor | Newest | Quality |
|---|---|---|---|---|
| Passenger Terminal Today | https://www.passengerterminaltoday.com/feed | **yes** | 24 Aug 2026 | summary → full |
| Airport Technology | https://www.airport-technology.com/feed/ | **yes** | 18 Aug 2026 | summary → full |
| Airport Industry-News | https://airportindustry-news.com/feed/ | **yes** | 24 Aug 2026 | summary → full |
| Airport World | https://airport-world.com/feed/ | **yes** | 24 Aug 2026 | full |
| Airport Improvement | https://airportimprovement.com/feed/ | **yes** | 21 Aug 2026 | full |
| AviationPros | https://www.aviationpros.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D | **yes** | 20 Aug 2026 | summary → full |
| Future Travel Experience | https://www.futuretravelexperience.com/feed/ | **yes** | 20 Aug 2026 | full |
| Regional Gateway | https://www.regionalgateway.net/feed/ | **yes** | 24 Aug 2026 | full |
| Moodie Davitt Report | https://moodiedavittreport.com/feed/ | **yes** | 24 Aug 2026 | full |
| TRBusiness | https://www.trbusiness.com/feed | **yes** | 24 Aug 2026 | summary → full |
| DFNI | https://www.dfnionline.com/feed/ | **yes** | 24 Aug 2026 | summary → full |
| Simple Flying (consumer-monitoring only) | https://simpleflying.com/feed/ | **yes** | 24 Aug 2026 | summary → full |
| Global Construction Review | https://www.globalconstructionreview.com/feed/ | no | 21 Aug 2026 | full |
| New Civil Engineer | https://www.newcivilengineer.com/feed/ | no | 24 Aug 2026 | summary → full (registration wall on site) |
| Construction Enquirer | https://www.constructionenquirer.com/feed/ | no | 24 Aug 2026 | full (short items) |
| ENR | https://www.enr.com/rss/articles | no | 21 Aug 2026 | summary → full |
| Construction Review Online | https://constructionreviewonline.com/feed/ | no | 24 Aug 2026 | summary → full |
| World Construction Network | https://www.worldconstructionnetwork.com/feed/ | no | 24 Aug 2026 | summary → full |

## Supplier brand newsrooms (9)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| Vanderlande (news post type) | https://www.vanderlande.com/feed/?post_type=news | 12 Aug 2026 | full |
| Alstef Group (also serves Glidepath content) | https://alstefgroup.com/feed/ | 22 Jul 2026 | full |
| Daifuku (whole group — filter for Airport Technologies items) | https://www.daifuku.com/rss_all.xml | 18 Aug 2026 | summary → full |
| Idemia | https://www.idemia.com/feed | 19 Aug 2026 | summary → full |
| Leidos | https://www.leidos.com/rss.xml | 3 Aug 2026 | full (in description) |
| Menzies Aviation | https://menziesaviation.com/feed/ | 18 Aug 2026 | full |
| WFS (Worldwide Flight Services) | https://www.wfs.aero/feed/ | 22 Jun 2026 | full |
| TLD Group | https://www.tld-group.com/feed/ | 28 Apr 2026 | summary → full (low volume) |
| Veovo | https://veovo.com/feed | 30 Apr 2026 | full (low volume) |

## Airports & operators (5)

| Name | feedUrl | Newest | Quality |
|---|---|---|---|
| daa / Dublin Airport | https://www.daa.ie/feed/ | 31 Jul 2026 | full |
| VINCI Airports | https://vinci-airports.com/en/feed/ | 22 Jul 2026 | full |
| Kansai Airports (KIX/ITM/Kobe, VINCI-operated) | https://www.kansai-airports.co.jp/en/news/feed/ | 24 Aug 2026 | summary → full (title-only items) |
| Brisbane Airport | https://newsroom.bne.com.au/feed/ | 16 Aug 2026 | full |
| Port of Seattle (SEA) | https://www.portseattle.org/rss.xml | 28 May 2026 | full (in description) |

## High-value sources with NO feed (lib/newsrooms.js candidates)

The four most valuable press offices in the sector publish no RSS at all —
same shape as fleet, where the misses were the four best sources on the list.
Verifying one `lib/newsrooms.js` entry takes ~10 minutes and runs forever; do
the top block during the DNS wait, competitors first.

| Name | newsHubUrl | What it has | How it could be read |
|---|---|---|---|
| **International Airport Review** | https://www.internationalairportreview.com/news | The core competitor, daily airport news; site moved off WordPress (/feed/ now 404s) | Server-rendered listing; anchors match `/{slug}/{id}.article` |
| **Heathrow media centre** | https://mediacentre.heathrow.com/news | Full press releases, category filters | Server-rendered; release anchors under `/pressrelease/...` |
| **Schiphol (Royal Schiphol Group)** | https://news.schiphol.com/ | Full releases incl. group/financial | PressPage platform; anchors `news.schiphol.com/{slug}/`; PressPage JSON API worth probing |
| **MAG (Manchester/Stansted/East Midlands)** | https://mediacentre.manchesterairport.co.uk/ | Full releases for three UK airports | PressPage; same pattern as Schiphol |
| Gatwick media centre | https://mediacentre.gatwickairport.com/ | Full releases | PressPage-style listing, no RSS |
| SITA pressroom | https://www.sita.aero/pressroom/ | Major air-transport-IT releases + industry data (baggage report) | Anchors `/about-us/pressroom/news-releases/{slug}/` |
| Smiths Detection | https://www.smithsdetection.com/press-releases/ | Screening/security wins — high relevance | WordPress with feeds disabled; anchors `/press-releases/{slug}/` |
| Swissport | https://www.swissport.com/en/news/current-news | Ground-handling releases | Anchors `/en/news/current-news/{year}/{slug}` — year in path aids dedupe |
| Fraport | https://www.fraport.com/en/newsroom/press-releases.html | Frankfurt + global portfolio | Heavy server-rendered page; scrape anchors under `/en/newsroom/` |
| ICAO newsroom | https://www.icao.int/newsroom | Global regulator | Cloudflare-blocked to non-browser clients — needs browser-engine fetch |
| Groupe ADP press | https://presse.groupeadp.fr/ | Paris + international | 403 to non-browser clients |
| Amadeus newsroom | https://amadeus.com/en/newsroom | Travel-tech releases | Server-rendered, no feed links |
| Aena press room | https://www.aena.es/en/ | World's biggest operator by passengers | English press paths 404 to bots; browser fetch needed |
| Changi Airport Group | https://www.changiairport.com/corporate/media-centre/newsroom.html | Full releases | JS listing, no RSS |
| PANYNJ press room | https://www.panynj.gov/port-authority/en/press-room.html | JFK/EWR/LGA releases | Server-rendered, no RSS |
| Eurocontrol | https://www.eurocontrol.int/news | Feed exists but went quiet Feb 2026; site still publishes | Scrape /news listing; re-check the feed quarterly |
| Cirium Thought Cloud | https://www.cirium.com/thoughtcloud/ | Aviation data analysis | WP /feed/ valid but EMPTY (custom post types) — the "empty is not working" trap |
| BEUMER Group | https://www.beumergroup.com/news/ | Baggage-handling releases | WP /feed/ valid but EMPTY — same trap |

## Rejected / dead (probed 24 Aug 2026 — so nobody re-finds them)

- TSA press rss.xml — valid, newest Oct 2024: stale
- Airports International / Key.aero rss.xml — newest Oct 2021: dead
- Aviation Week rss.xml — Drupal node dump, paywalled: unusable as a wire
- Collins Aerospace — valid, newest Jul 2025: stale
- Finavia — valid, newest Jun 2022: stale
- Glidepath /feed/ — serves the identical Alstef Group feed (acquired): duplicate
- anna.aero — TLS cert broken, /feed/ 404s: effectively dead
- Airside International — feed path returns a JS-challenge page, not XML
- Ground Handling International, MEED (paywalled), ACI Asia-Pacific, AAAE — no usable feed
- No feed at standard paths or via autodiscovery: ADB Safegate (blog domain parked), Thales (connection resets), Frequentis, Indra, KONE, TK Elevator, Honeywell Aerospace, JCDecaux, Avolta, Lagardère TR, SSP Group, SKIDATA, Xovis, Assaia, Oshkosh AeroTech, dnata, Materna IPS, Leonardo
- Airport/operator press offices with no feed (lower priority; revisit if a beat demands them): Munich, Zurich, Luton (media subdomain DNS dead), Avinor, Swedavia, Vienna, Copenhagen, Dubai Airports, Hamad, Incheon, Narita, Malaysia Airports, GMR, Adani, Western Sydney, Athens, LAWA, Chicago DOA, Toronto Pearson, YVR, SFO, DFW, Denver, Houston, Sydney, Auckland, Edinburgh, Birmingham, Bristol, AGS
