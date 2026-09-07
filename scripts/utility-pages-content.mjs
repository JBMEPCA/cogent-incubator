// The six or seven utility pages every title needs, written per title.
//
// These are the pages the footer and the navigation link to on every single
// page of every site. On 6 September 2026 all four of the newer titles linked
// to all of them and published none of them, so each site carried six or seven
// site-wide 404s. Smart SME had the full set, which is most of why it reads as
// a real publication and the others do not.
//
// Two of them are not optional in the way the others are. There was no privacy
// policy on any of the four while all four ran Google Analytics behind a consent
// banner and took newsletter signups. And there was no advertise page on titles
// whose whole purpose is selling advertising.
//
// The copy is deliberately NOT a find-and-replace of Smart SME's. An advertise
// page that lists the wrong advertiser categories, or a submit-news page that
// asks for the wrong kind of story, is worse than no page: it tells a PR that
// this title does not know its own sector. Every list below comes from that
// title's own vertical brief and alignment sheet.
//
// Shortcodes are the parent's canonical names (cogent_enquiry, cogent_newsletter,
// cogent_cogent). Smart SME's live pages use the smartsme_* legacy aliases; do
// not copy those forward.

const PUBLISHER =
  "Cogent Multimedia Ltd, an independent UK publisher based at 5 Jubilee Way, Faversham, Kent.";

const p = (s) => `<p class="wp-block-paragraph">${s}</p>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const ul = (items) =>
  `<ul class="wp-block-list">\n${items.map((i) => `<li>${i}</li>`).join("\n")}\n</ul>`;
const button = (href, label) =>
  `<div class="wp-block-buttons is-layout-flex wp-block-buttons-is-layout-flex">\n` +
  `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${href}">${label}</a></div>\n` +
  `</div>`;

// ── Per-title facts ──────────────────────────────────────────────────────────
// `linkedin` is null where no company page exists yet. Every template checks it
// rather than printing a dead link, which is the mistake this whole exercise is
// correcting.

export const TITLES = {
  "fleet-magazine": {
    name: "The Fleet Magazine",
    domain: "thefleetmagazine.co.uk",
    email: "jb@thefleetmagazine.co.uk",
    linkedin: "https://www.linkedin.com/company/the-fleet-magazine",
    consentKey: "cogent-consent",
    // submit-news already exists on this title and is untouched.
    skip: ["submit-news"],

    oneLiner:
      "The Fleet Magazine is the UK publication for the people who run vans, trucks and company cars: what the rules change, what it costs, and what to do about it.",
    aboutBody: [
      "We are written for fleet managers, transport managers and operations directors, from owner-operators running ten vehicles to corporate fleets of several thousand, along with the finance, HR and procurement people who share those decisions.",
      "Every piece answers the same question: what does this cost you, and what do you do next. We cover tax and legislation, the electric transition, compliance, leasing and funding, telematics and the running costs underneath all of it.",
    ],
    adLede: "Reach the people who sign for UK vans, trucks, company cars and the depots they run out of.",
    audienceForAds:
      "The Fleet Magazine is read by the people who sign for vehicles, contracts and depot infrastructure. They are making decisions about leasing, charging, telematics, fuel and compliance, and they are being sold to constantly by everyone else.",
    adFormats: [
      "<strong>Display advertising</strong> in leaderboard, billboard and MPU positions across the site.",
      "<strong>Category sponsorship</strong>, your brand against Electric &amp; Charging, Leasing &amp; Funding, Telematics &amp; Technology or Costs &amp; Efficiency.",
      "<strong>Sponsored articles</strong>, written to the same standard as our editorial and clearly labelled.",
      "<strong>Newsletter sponsorship</strong>, a fixed slot in the weekly send, and solus email to our subscribers.",
    ],
    sourcing:
      "We check facts against primary sources: HMRC and gov.uk for tax and rates, the DVSA and the Traffic Commissioners for licensing and compliance, and the SMMT, BVRLA and Logistics UK for market data. Vehicle costs come from published pricing and published rate tables, and we say which tax year a figure belongs to. Where we are uncertain, we say so.",
    newsWanted: [
      "<strong>Contract wins and fleet deals.</strong> Who has just taken on how many vehicles, and from whom.",
      "<strong>Appointments and promotions.</strong> Fleet directors, transport managers, heads of fleet.",
      "<strong>Depot and charging infrastructure.</strong> New sites, grid connections, charger deployments.",
      "<strong>Product launches</strong> a fleet would realistically buy: vehicles, telematics, fuel and charge cards, software.",
      "<strong>Compliance and enforcement</strong>: earned recognition, public inquiries, licence action, DVSA activity.",
      "<strong>Research with real numbers</strong> on running costs, uptime, residuals or the EV transition.",
    ],
    newsNotWanted: [
      "Consumer motoring, performance cars or lifestyle content",
      "Announcements with no UK fleet operator angle",
      "Rewritten corporate boilerplate with nothing new in it",
      "Supplier claims we cannot check, or statistics with no published source",
    ],
    interviewLine:
      "The Fleet Magazine runs a regular interview with a named person running a real fleet. If you or a client would make a good subject, say so in the same email and tell us in a line or two what decision or change makes the story worth a reader's time.",
    prLine:
      "If you are building a UK fleet and commercial vehicle media list, please add The Fleet Magazine.",
    newsletterBullets: [
      "The tax and legislation changes that alter what your fleet costs next quarter, with the arithmetic done.",
      "The electric transition as an operating problem: charging, residuals, payload, real-world range.",
      "Leasing, funding and whole-life cost, plus the compliance deadlines worth diarising.",
    ],
  },

  "golf-resort-magazine": {
    name: "Golf Resort Magazine",
    domain: "golfresortmagazine.com",
    email: "jb@golfresortmagazine.com",
    linkedin: "https://www.linkedin.com/company/golf-resort-magazine",
    consentKey: "cogent-consent",
    skip: [],
    global: true,

    oneLiner:
      "Golf Resort Magazine covers the business of golf resorts worldwide: how they are financed, built, bought, sold and run.",
    aboutBody: [
      "We are written for resort owners, investors, general managers, directors of golf, course managers, developers, architects and golf tour operators, from single independent properties to multi-property management companies.",
      "A golf resort is a hospitality P&amp;L with a tee sheet attached. It has to fill rooms and rounds, feed people, manage water and agronomy costs, and answer to an owner. That is the business we write about, not the tour and not the weekend round.",
    ],
    adLede: "Reach the owners, operators and developers who specify and buy for golf resorts worldwide.",
    audienceForAds:
      "Golf Resort Magazine reaches the people who specify and buy for golf resorts worldwide: turf machinery and irrigation, agronomy, golf cars, clubhouse and course technology, revenue management, distribution, architecture and construction, and everything a resort hotel buys alongside it.",
    adFormats: [
      "<strong>Display advertising</strong> in leaderboard, billboard and MPU positions across the site.",
      "<strong>Category sponsorship</strong>, your brand against Course &amp; Grounds, Technology, Sustainability &amp; Water, Operations &amp; Revenue or Development &amp; Design.",
      "<strong>Sponsored articles and supplier features</strong>, written to the same standard as our editorial and clearly labelled.",
      "<strong>Newsletter sponsorship</strong>, a fixed slot in the weekly send, and solus email to our subscribers.",
      "<strong>Show and season campaigns</strong> timed to the PGA Show, GCSAA, BTME and IGTM.",
    ],
    sourcing:
      "We check facts against primary sources: company announcements and filings for transactions, planning and permitting documents for developments, and published research from the R&amp;A, the National Golf Foundation, GCSAA and IAGTO for market data. We report money in the market's own currency and say when a figure was disclosed. Where a number has not been disclosed, we say that rather than estimating it.",
    newsWanted: [
      "<strong>Transactions.</strong> Acquisitions, disposals, portfolio deals and the parties behind them.",
      "<strong>Development and renovation.</strong> New builds, redesigns, clubhouse and hotel projects, with architect and contractor named.",
      "<strong>Appointments.</strong> General managers, directors of golf, superintendents and course managers, executive hires at management companies.",
      "<strong>Operations and revenue.</strong> Pricing, membership, distribution deals, technology rollouts.",
      "<strong>Agronomy, water and sustainability</strong> where there is a cost, a restriction or a capital decision attached.",
      "<strong>Golf travel trade.</strong> Operator partnerships, group business, route and access changes that move rounds.",
    ],
    newsNotWanted: [
      "Tournament and tour coverage, results, leaderboards and player news",
      "Consumer travel content, course rankings and bucket lists",
      "Announcements with no owner, operator or developer angle",
      "Supplier claims we cannot check, or statistics with no published source",
    ],
    interviewLine:
      "Golf Resort Magazine runs a regular interview with a named person running or building a resort. If you or a client would make a good subject, say so in the same email and tell us in a line or two what decision, risk or change makes the story worth a reader's time.",
    prLine:
      "If you are building a golf trade or hospitality media list, please add Golf Resort Magazine. We cover the sector globally, not only the UK.",
    newsletterBullets: [
      "Who bought what, who is building where, and what it cost.",
      "Operations and revenue: pricing, tee sheet yield, membership, distribution and the technology underneath.",
      "Agronomy, water and sustainability as capital and operating decisions, not technique.",
    ],
  },

  "barbering-business": {
    name: "Barbering Business",
    domain: "barberingbusiness.com",
    email: "jb@barberingbusiness.com",
    linkedin: "https://www.linkedin.com/company/barbering-business",
    consentKey: "cogent-consent",
    skip: [],

    oneLiner:
      "Barbering Business is written for barbers and barbershop owners who want to make more money from the shop they already have.",
    aboutBody: [
      "Most people who open a barbershop know barbering. Nobody teaches them the business bit: what a chair should really cost, when to put prices up, whether to employ or rent, which booking system is worth paying for, and how to keep the diary full in January.",
      "That is what we write about. Profit, costs, kit, fit-out, marketing, staffing and the trends worth putting on your menu, written for the person who owns the shop.",
    ],
    adLede: "Reach the shop owners who buy the clippers, the chairs, the booking system and the card machine.",
    audienceForAds:
      "Barbering Business reaches shop owners and the multi-site groups growing fastest, the people who actually buy clippers, chairs, furniture, styling product, booking software, card machines and insurance. It is a small, unusually homogeneous audience, and almost nobody is talking to it about business.",
    adFormats: [
      "<strong>Display advertising</strong> in leaderboard, billboard and MPU positions across the site.",
      "<strong>Category sponsorship</strong>, your brand against Products &amp; Tools, Shop &amp; Fit-Out, Tech &amp; Booking or Business &amp; Money.",
      "<strong>Product placement in the monthly kit round-up</strong>, our standing new-products feature.",
      "<strong>Sponsored articles</strong>, written to the same standard as our editorial and clearly labelled.",
      "<strong>Newsletter sponsorship</strong>, a fixed slot in the weekly send, and solus email to our subscribers.",
    ],
    sourcing:
      "We check facts against primary sources: HMRC and gov.uk for VAT, rates and employment rules, the National Hair &amp; Beauty Federation and Companies House for sector data, and published vendor pricing for anything we quote a price on. When we say a piece of kit costs a number, that number came from a price list, not a press release. Where we are uncertain, we say so.",
    newsWanted: [
      "<strong>Openings, expansions and groups.</strong> New shops, second sites, franchise growth, acquisitions.",
      "<strong>Product launches</strong> a shop would realistically buy: clippers, trimmers, chairs, furniture, styling product, booking and payment kit.",
      "<strong>Awards and competition results</strong> where the shortlist is genuinely competitive.",
      "<strong>Training and apprenticeships.</strong> New courses, academy launches, funding and qualification changes.",
      "<strong>Money and policy</strong> where the consequence for a shop is clear: VAT, business rates, wage rates, energy.",
      "<strong>People.</strong> Owners doing something worth copying, and the barbers behind them.",
    ],
    newsNotWanted: [
      "Consumer style content, haircut trends written for the person in the chair",
      "Hair loss, grooming or product content aimed at the public",
      "Ladies' salon stories with no barbershop consequence",
      "Announcements with nothing an owner would do differently on Monday",
    ],
    interviewLine:
      "Barbering Business runs a regular interview with a shop owner about how they actually run the place. If you or a client would make a good subject, say so in the same email and tell us in a line or two what makes the story worth a reader's time.",
    prLine:
      "If you are building a barbering or male grooming trade media list, please add Barbering Business.",
    newsletterBullets: [
      "What things cost and what to charge: rent, wages, VAT, price rises and the arithmetic behind them.",
      "New kit worth buying, with prices and who it is actually for.",
      "Marketing, booking and retention: the practical stuff that fills chairs on a quiet Tuesday.",
    ],
  },

  "airport-business-magazine": {
    name: "Airport Business Magazine",
    domain: "airportbusinessmagazine.com",
    email: "jb@airportbusinessmagazine.com",
    linkedin: null, // No company page yet. Do not print a dead link.
    consentKey: "cogent-consent",
    skip: [],
    global: true,

    oneLiner:
      "Airport Business Magazine covers the airport as a business: how it makes money, what it is building, and what it buys to run.",
    aboutBody: [
      "We are written for the people on the airport side of the fence: chief executives and commercial directors, heads of security, passenger experience and cargo, development and planning leads, procurement, route development, and the ownership groups, investors, architects, contractors and suppliers around them.",
      "There is plenty of coverage of what happens at airports. There is very little on how they earn, what a terminal actually costs, who won the contract and what the system on the stand is worth. That is the gap we write into. No consumer travel content, ever.",
    ],
    adLede: "Reach the people who shortlist and sign for airport systems, services and capital programmes worldwide.",
    audienceForAds:
      "Airport Business Magazine reaches the people who specify, shortlist and sign for airport systems and services: baggage handling, screening and biometrics, ground support equipment, airfield lighting, air traffic systems, operations software, parking and access control, retail and food concessions, and the architects, engineers and contractors delivering capital programmes.",
    adFormats: [
      "<strong>Display advertising</strong> in leaderboard, billboard and MPU positions across the site.",
      "<strong>Category sponsorship</strong>, your brand against Revenue &amp; Commercial, Expansion &amp; Construction, Technology &amp; Systems or Operations &amp; Resilience.",
      "<strong>Sponsored articles and technical features</strong>, written to the same standard as our editorial and clearly labelled.",
      "<strong>Newsletter sponsorship</strong>, a fixed slot in the weekly send, and solus email to our subscribers.",
      "<strong>Show campaigns</strong> timed to Passenger Terminal Expo, Inter Airport and Routes World.",
    ],
    sourcing:
      "We check facts against primary sources: airport and ownership group financial reports, published tender and contract award documents, planning and permitting records, and data from ACI, IATA, the CAA and the FAA. We report money in the market's own currency, name the contractor and the programme phase, and say when a figure was disclosed rather than estimated. Where a cost has not been published, we say so.",
    newsWanted: [
      "<strong>Capital programmes.</strong> New terminals, runways, expansions and refurbishments, with budget, phase and contractor.",
      "<strong>Contract awards.</strong> Who won what, for how much, and what it replaces.",
      "<strong>Commercial and non-aero.</strong> Concession tenders, retail and F&amp;B deals, parking, advertising, real estate.",
      "<strong>Technology rollouts.</strong> Screening, biometrics, common use, baggage, ops platforms, autonomous and electrified airside.",
      "<strong>Route development.</strong> New routes, incentive schemes, airline agreements and what they are worth.",
      "<strong>Appointments</strong> at airports, ownership groups and the major suppliers.",
    ],
    newsNotWanted: [
      "Consumer travel content, lounge reviews, best and worst airport lists",
      "Airline network and fleet news with no airport-side consequence",
      "Incidents, disruption and crime coverage without an operational or commercial angle",
      "Supplier claims we cannot check, or statistics with no published source",
    ],
    interviewLine:
      "Airport Business Magazine runs a regular interview with a named person running an airport or a major programme. If you or a client would make a good subject, say so in the same email and tell us in a line or two what decision or change makes the story worth a reader's time.",
    prLine:
      "If you are building an airport or aviation infrastructure media list, please add Airport Business Magazine. We cover the sector globally, not only the UK.",
    newsletterBullets: [
      "Where the money comes from: non-aero revenue, concessions, parking and property.",
      "The global expansion pipeline, with budgets, phases and the contractors winning the work.",
      "The systems airports are actually buying, compared, with costs attached.",
    ],
  },
};

// ── Page templates ───────────────────────────────────────────────────────────

const linkedinSentence = (t) =>
  t.linkedin
    ? ` or follow us on <a href="${t.linkedin}" target="_blank" rel="noopener">LinkedIn</a>`
    : "";

export function buildPages(t) {
  const mailto = `<a href="mailto:${t.email}">${t.email}</a>`;
  const scope = t.global ? "worldwide" : "the UK";

  const pages = {
    about: {
      title: "About",
      content: [
        p(t.oneLiner),
        ...t.aboutBody.map(p),
        h2(`Who publishes ${t.name}`),
        p(`${t.name} is published by <strong>Cogent Multimedia Ltd</strong>, ${PUBLISHER.replace("Cogent Multimedia Ltd, an ", "an ")} Cogent Multimedia has published business-to-business titles for industry for many years.`),
        p(
          `Read our <a href="/editorial-standards/">editorial standards</a>, get in touch via the <a href="/contact/">contact page</a>${linkedinSentence(t)}.`
        ),
        "<p>[cogent_cogent]</p>",
      ].join("\n"),
    },

    contact: {
      title: "Contact",
      content: [
        p(
          "Editorial, advertising and general enquiries: we would love to hear from you. Fill this in and it comes straight to the editor."
        ),
        "<p>[cogent_enquiry]</p>",
        h2("Prefer email?"),
        p(
          `Write to ${mailto}${
            t.linkedin
              ? ` or find us on <a href="${t.linkedin}">LinkedIn</a>`
              : ""
          }.`
        ),
        p(
          `Spotted an error? Tell us and we will put it right. Our <a href="/editorial-standards/">editorial standards</a> set out how we handle corrections.`
        ),
        p(`${t.name} is published by ${PUBLISHER}`),
      ].join("\n"),
    },

    advertise: {
      title: "Advertise",
      content: [
        p(t.adLede),
        p(t.audienceForAds),
        h2("Ways to work with us"),
        ul(t.adFormats),
        h2("Get in touch"),
        p(
          "Tell us who you are trying to reach and what you want it to do, and we will come back with a plan, availability and a price. We can also send the current media pack."
        ),
        button(
          `mailto:${t.email}?subject=${encodeURIComponent("Advertising with " + t.name)}`,
          "Email us about advertising"
        ),
        '<p>[cogent_enquiry topic="Advertising"]</p>',
      ].join("\n"),
    },

    newsletter: {
      title: "Newsletter",
      content: [
        p(
          `The best of ${t.name} in your inbox, free and weekly. No fluff.`
        ),
        '<p>[cogent_newsletter variant="band" source="newsletter-page"]</p>',
        h2("What you get"),
        ul(t.newsletterBullets),
        p(
          `One email a week. Unsubscribe in one click, and we never share your address. See our <a href="/privacy-policy/">privacy policy</a>.`
        ),
      ].join("\n"),
    },

    "editorial-standards": {
      title: "Editorial Standards",
      content: [
        p(
          `${t.name} exists to give ${
            t.global ? "its readers worldwide" : "its readers"
          } practical, trustworthy intelligence they can act on. These are the standards we hold ourselves to.`
        ),
        h2("Accuracy and sourcing"),
        p(t.sourcing),
        h2("Corrections"),
        p(
          `When we get something wrong, we correct it quickly. Material corrections are noted on the article itself. If you spot an error, email ${mailto} and we will review it promptly.`
        ),
        h2("How we use AI"),
        p(
          "AI tools help our team research, draft and edit. Every article is reviewed by a human editor before publication, and responsibility for everything we publish rests with the editorial team, not the tools."
        ),
        h2("Advertising and sponsored content"),
        p(
          `${t.name} is funded by advertising. Advertising is clearly labelled, sponsored content is marked as sponsored, and advertisers have no influence over our independent editorial coverage. We do not accept payment for favourable reviews.`
        ),
        h2("Ownership"),
        p(`${t.name} is published by ${PUBLISHER}`),
      ].join("\n"),
    },

    "privacy-policy": {
      title: "Privacy Policy",
      content: [
        p(
          `This policy explains what information ${t.name} (&#8220;we&#8221;, &#8220;us&#8221;) collects when you visit ${t.domain}, how we use it, and the choices you have. Last updated: 7 September 2026.`
        ),
        h2("Who we are"),
        p(
          `${t.name} is published by Cogent Multimedia Ltd from the United Kingdom. You can contact us about anything in this policy at ${mailto}.`
        ),
        h2("What we collect and why"),
        ul([
          "<strong>Analytics</strong>: with your consent, we use Google Analytics 4 to understand how the site is used, such as which pages are read, the type of device and browser, and approximate location derived from your IP address. Analytics runs only if you choose Accept on our cookie banner.",
          "<strong>Newsletter</strong>: if you subscribe, we store your email address in order to send you the newsletter. It is held by us and by Mailchimp, who send it on our behalf. You can unsubscribe from any issue in one click.",
          "<strong>Correspondence</strong>: if you email us or use a form on the site, we keep the correspondence for as long as needed to deal with your enquiry.",
          "<strong>Server logs</strong>: our hosting provider keeps standard server logs, including IP addresses and request times, for security and reliability.",
        ]),
        h2("Cookies"),
        p(
          `If you accept analytics on our cookie banner, Google Analytics sets cookies named _ga and _ga_* which last up to two years. Your consent choice itself is stored in your browser&#8217;s local storage under the key ${t.consentKey} so that we do not ask you on every visit. If you decline, no analytics cookies are set.`
        ),
        h2("Legal bases"),
        p(
          "We rely on your consent for analytics and for the newsletter, and on our legitimate interests for site security and for responding to enquiries you send us."
        ),
        h2("Who we share information with"),
        p(
          "Google processes analytics data on our behalf. Mailchimp processes newsletter subscriptions on our behalf. Our hosting provider, SiteGround, processes server logs. We do not sell personal information, and we do not share it with anyone else except where the law requires."
        ),
        h2("How long we keep information"),
        p(
          "Analytics data is retained in Google Analytics for up to 14 months. Newsletter subscriptions are kept until you unsubscribe. Email correspondence is kept for as long as needed to deal with the matter it relates to."
        ),
        h2("Your rights"),
        p(
          `Under UK data protection law you have the right to request access to, correction of, or deletion of your personal information, to object to or restrict how we use it, and to data portability. To exercise any of these rights, email ${mailto}. You also have the right to complain to the Information Commissioner&#8217;s Office at <a href="https://ico.org.uk" target="_blank" rel="noopener">ico.org.uk</a>.`
        ),
        h2("Changes to this policy"),
        p(
          "If we change how we handle personal information, we will update this page and revise the date at the top."
        ),
      ].join("\n"),
    },

    "submit-news": {
      title: "Submit your news",
      content: [
        `<p class="has-large-font-size">${t.name} publishes news that changes what a reader should do next. If you have that, we want to hear from you.</p>`,
        h2("What we publish"),
        p(
          `We cover ${
            t.global ? "this sector worldwide" : "this sector in the UK"
          }, and we are interested in the things that actually move, not marketing copy but events.`
        ),
        ul(t.newsWanted),
        h2("What we are less likely to run"),
        ul(t.newsNotWanted),
        h2("How to send it"),
        p(`Email ${mailto}. It reaches the editor directly.`),
        p(
          "Paste the release into the body of the email rather than attaching it, and include:"
        ),
        ul([
          "A link to the announcement or news hub on your own site",
          "Any embargo date, clearly marked in the subject line",
          "A named contact we can come back to with questions",
          "Images as links rather than attachments, with any credit or licence noted",
        ]),
        h2("What happens next"),
        p(
          "We read everything. We cannot reply to everything, and a story we do not run this week may still be useful later, so nothing is wasted by sending it."
        ),
        p(
          "Where we publish, we write our own version rather than reproducing a release, and we will link to the company and to the original announcement. If a fact does not stand up we will ask before we print it, or leave it out."
        ),
        h2("Pitching a feature or an interview"),
        p(t.interviewLine),
        h2("For PR agencies"),
        p(
          `${t.prLine} Releases sent to ${mailto} reach the editor without going through a form.`
        ),
        h2("Corrections"),
        p(
          `If we have published something inaccurate, email ${mailto} with the article link and what is wrong, and we will correct it.`
        ),
      ].join("\n"),
    },
  };

  for (const slug of t.skip || []) delete pages[slug];
  return pages;
}

export const PAGE_ORDER = [
  "about",
  "contact",
  "advertise",
  "newsletter",
  "editorial-standards",
  "privacy-policy",
  "submit-news",
];
