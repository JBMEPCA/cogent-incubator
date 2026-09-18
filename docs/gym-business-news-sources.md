# Gym Business News: verified wire sources

Every feedUrl below was fetched and verified on 18 Sep 2026 by
`scratchpad/gym/check-feeds.mjs` (HTTP 200, parses as RSS or Atom, at least one
item, newest-item date recorded). **45 direct feeds** against the playbook's 30+
target. They are seeded by `scripts/seed-gym-business-news-sources.mjs`, which
also carries the hub-only rows listed at the end.

Scope reminder, because it decides what earns a row: this title covers the
business of fitness for small operators (independent gyms, studios, PT
businesses, franchisees), never the practice of fitness. A feed whose output is
mostly workouts, nutrition or results content does not go in, however large.

**Ingester notes:**
- The gov.uk organisation `.atom` feeds carry summaries with direct links;
  the article body is one fetch away and runs long.
- PR Newswire and GlobeNewswire are keyword or category wires. Expect roughly a
  third of items to be off-seam (consumer apps, sports teams); the Researcher is
  the filter, same as the Google News queries.
- **Deliberately NOT seeded:** the gov.uk keyword search wires
  (`news-and-communications.atom?keywords=gym`, `=gyms`, `=leisure+centres`,
  `=subscription+contracts`). They return valid feeds, but gov.uk keyword search
  is loose: on 18 Sep the top item for "gym" was a knife-crime release and for
  "subscription contracts" a dementia speech. The CMA, DBT and DCMS organisation
  feeds carry the same policy with none of the noise.
- **Also rejected after fetching:** DHSC, OHID and DfE organisation feeds
  (valid, but health guidance and schools; the scope rule makes most items a
  liability rather than a source), PR Newswire's health list (clinical), the
  BusinessWire feed (unscoped), Franchise Chatter and Entrepreneur's latest
  feed (consumer franchise-review content, general business), Membr (last item
  Feb 2024, acquired by Xplor) and Hussle (last item Apr 2026).

## Policy, regulators and sector bodies (24)

| Name | feedUrl | Items | Newest | Body |
|---|---|---|---|---|
| CIMSPA | https://cimspa.co.uk/feed/ | 10 | 7 Sep 2026 | summary |
| Sport England (gov.uk) | https://www.gov.uk/government/organisations/sport-england.atom | 20 | 23 Jul 2026 | summary |
| DCMS | https://www.gov.uk/government/organisations/department-for-culture-media-and-sport.atom | 20 | 17 Sep 2026 | summary |
| HMRC | https://www.gov.uk/government/organisations/hm-revenue-customs.atom | 20 | 18 Sep 2026 | summary |
| HM Treasury | https://www.gov.uk/government/organisations/hm-treasury.atom | 20 | 18 Sep 2026 | summary |
| Dept for Business and Trade | https://www.gov.uk/government/organisations/department-for-business-and-trade.atom | 20 | 18 Sep 2026 | summary |
| Companies House | https://www.gov.uk/government/organisations/companies-house.atom | 20 | 17 Sep 2026 | summary |
| Insolvency Service | https://www.gov.uk/government/organisations/insolvency-service.atom | 20 | 18 Sep 2026 | summary |
| Low Pay Commission | https://www.gov.uk/government/organisations/low-pay-commission.atom | 20 | 1 Sep 2026 | summary |
| Valuation Office Agency | https://www.gov.uk/government/organisations/valuation-office-agency.atom | 20 | 30 Jul 2026 | summary |
| HSE (gov.uk) | https://www.gov.uk/government/organisations/health-and-safety-executive.atom | 20 | 17 Sep 2026 | summary |
| HSE press office | https://press.hse.gov.uk/feed/ | 10 | 17 Sep 2026 | full |
| Competition and Markets Authority | https://www.gov.uk/government/organisations/competition-and-markets-authority.atom | 20 | 18 Sep 2026 | summary |
| Skills England | https://www.gov.uk/government/organisations/skills-england.atom | 20 | 27 Aug 2026 | summary |
| PPL PRS (TheMusicLicence) | https://pplprs.co.uk/feed/ | 10 | 3 Sep 2026 | full |
| PPL | https://www.ppluk.com/feed/ | 12 | 8 Jul 2026 | full |
| British Chambers of Commerce | https://www.britishchambers.org.uk/feed/ | 10 | 17 Sep 2026 | full |
| Health and Fitness Association (US, ex-IHRSA) | https://www.healthandfitness.org/feed/ | 12 | 16 Sep 2026 | full |
| Swimming Teachers' Association | https://www.sta.co.uk/feed/ | 10 | 18 Sep 2026 | full |
| YMCA Awards | https://www.ymcaawards.co.uk/feed/ | 10 | 2 Sep 2026 | full |
| Swim England | https://www.swimming.org/swimengland/feed/ | 10 | 8 Sep 2026 | summary |
| International Franchise Association (US) | https://www.franchise.org/feed/ | 10 | 17 Sep 2026 | full |
| AUSactive (Australia) | https://ausactive.org.au/feed/ | 10 | 17 Sep 2026 | full |
| Exercise New Zealand | https://www.exercise.org.nz/feed/ | 10 | 11 Sep 2026 | full |

## Sector, market and small-business press (9); competitor-flagged rows are monitoring sources

| Name | feedUrl | Competitor | Items | Newest | Body |
|---|---|---|---|---|---|
| Athletech News | https://athletechnews.com/feed/ | **yes** (US, Tranco ~248k) | 20 | 18 Sep 2026 | full |
| Club Solutions Magazine | https://clubsolutionsmagazine.com/feed/ | **yes** (US) | 8 | 18 Sep 2026 | full |
| WellNation | https://wellnation.uk/feed/ | **yes** (UK) | 10 | 18 Sep 2026 | full |
| Franchise Times | https://www.franchisetimes.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc | no (all-sector franchise trade) | 50 | 17 Sep 2026 | summary |
| The PT Development Center | https://www.theptdc.com/feed | no (PT business education, US) | 100 | 18 Sep 2026 | full |
| Future Fit | https://www.futurefit.co.uk/blog/feed/ | no (training provider) | 10 | 17 Sep 2026 | full |
| SmallBusiness.co.uk | https://smallbusiness.co.uk/feed/ | no | 12 | 16 Sep 2026 | full |
| Simply Business | https://www.simplybusiness.co.uk/feed/ | no | 10 | 16 Sep 2026 | full |
| Mintel press centre | https://www.mintel.com/press-centre/feed/ | no | 12 | 5 Aug 2026 | full |

## Press-release wires (3)

| Name | feedUrl | Items | Newest | Body |
|---|---|---|---|---|
| PR Newswire: sports | https://www.prnewswire.com/rss/sports-latest-news/sports-latest-news-list.rss | 20 | 18 Sep 2026 | summary |
| GlobeNewswire: keyword "fitness" | https://www.globenewswire.com/RssFeed/keyword/fitness | 20 | 14 Sep 2026 | summary |
| GlobeNewswire: keyword "gym" | https://www.globenewswire.com/RssFeed/keyword/gym | 20 | 9 Sep 2026 | summary |

## Software, payments, equipment and developers (9)

| Name | feedUrl | Items | Newest | Body |
|---|---|---|---|---|
| ClubWise | https://www.clubwise.com/feed/ | 12 | 18 Aug 2026 | summary |
| Xplor | https://xplor.com/feed/ | 12 | 10 Aug 2026 | full |
| Glofox (ABC Glofox) | https://www.glofox.com/feed/ | 10 | 17 Sep 2026 | full |
| ABC Fitness | https://abcfitness.com/feed/ | 9 | 17 Sep 2026 | full |
| Zen Planner | https://www.zenplanner.com/feed | 20 | 31 Aug 2026 | summary |
| Legend | https://www.legendware.co.uk/feed/ | 10 | 1 Sep 2026 | full |
| Wattbike | https://wattbike.com/blogs/news.atom | 30 | 29 Aug 2026 | full |
| Indigo Fitness | https://indigofitness.com/feed/ | 10 | 7 Sep 2026 | full |
| Alliance Leisure | https://allianceleisure.co.uk/feed/ | 10 | 16 Sep 2026 | full |

## Hub-only rows (no working feed on 18 Sep 2026)

Seeded without a feedUrl: `lib/feeds.js` autodiscovery gets a second try, and
every row earns its place as an outreach, advertiser or monitoring target.

| Name | What happened | Why it stays |
|---|---|---|
| ukactive | 403 on `/feed/` and `/news/feed/` (bot wall) | the trade body; its releases arrive via the Google News queries |
| Health Club Management | `/rss` redirects to a "TEST PAGE" behind a bot challenge | **competitor**, the incumbent |
| Leisure Opportunities | feed live but it is the jobs feed with malformed dates | **competitor**, same portfolio |
| Sports Management | `/rss/index.cfm` returns no items | **competitor**, same portfolio |
| Gym Owner Monthly | `/feed/` and `?feed=rss2` redirect to the homepage (feed disabled) | **competitor**, our exact seam; its WP REST API does work |
| Fitt Insider | feed returns no items | **competitor** (US) |
| Club Industry | 403 | **competitor** (US) |
| Australasian Leisure Management | 403 | reference point; strong in Google News |
| 1851 Franchise, What Franchise, Elite Franchise | no feed, 403 or redirect | franchise press |
| British Franchise Association | `/feed/` empty | trade body |
| EuropeActive, Community Leisure UK, LGA, Active IQ | 404 or 403 | bodies and awarding organisations |
| TeamUp, PushPress, Mindbody, Wodify, Exercise.com, Gymdesk, Perfect Gym, Resamania, Gantner, Wellhub (403), Daxko (429), EGYM, Myzone | no feed found | software advertisers; the SERP owners |
| Harlands, Ashbourne (expired certificate), GoCardless | no feed | payments and DD collection |
| Ripe Insurance (403), Insure4Sport | no feed | insurance advertisers |
| Technogym, Life Fitness, Matrix Fitness, Precor, Escape Fitness (403), Concept2 (403), Physical Company | no feed | equipment advertisers |
| Anytime Fitness UK, Snap Fitness, PureGym, The Gym Group, Hussle | no feed or stale | operators and franchisors |
| Elevate (ExCeL London) | no feed | the UK trade show; the exhibitor list is the prospect list |
