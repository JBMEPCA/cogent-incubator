# Apollo brief: The Fleet Magazine

For Lucas. Target: **5,000-8,000 verified UK fleet decision-makers**, CSV.

---

## Before the titles: the filter that decides whether this works

UK fleet has two populations and Apollo will hand over the wrong one by default.

| | Size |
|---|---|
| Professional buyers — choose suppliers, set policy, sign off spend | ~35,000-50,000 |
| Company car drivers and user-choosers | **~920,000** (HMRC, 2024-25) |

Twenty to one. Any loose filter fills the list with drivers, who buy nothing,
never open a trade newsletter, and dilute the audience figure we sell to
advertisers. Fleet News, the market leader, has ~32-35,000 newsletter
subscribers and only **13,800** opted in to third-party contact. A tight 6,000
beats a loose 25,000. **Do not ask for volume.**

---

## Job titles

Apollo matches these as free text, so give Lucas the list and let it fuzzy-match.

### Tier 1 — the people who sign things (highest value, get these first)

```
Fleet Director · Head of Fleet · Group Fleet Manager · Fleet Manager
Transport Director · Head of Transport · Transport Manager
Operations Director · Head of Operations
Managing Director · Owner · Proprietor · General Manager
```

Transport Manager sits in Tier 1 rather than Tier 2 because on an O-licence it
is a legally named role with personal liability, not a job description.

### Tier 2 — department heads. These map onto our seven sections, which is the point: each one is a section, and each section is a sponsorship slot.

```
Vans & LCV            LCV Manager · Van Fleet Manager · Commercial Vehicle Manager · Depot Manager
Electric & Charging   Sustainability Manager · Energy Manager · Head of Decarbonisation · EV Programme Manager
Tax & Legislation     Finance Director · Financial Controller · Reward Manager · Benefits Manager
Compliance & Safety   HSEQ Manager · SHEQ Manager · Health and Safety Manager · Compliance Manager
Leasing & Funding     Procurement Manager · Head of Procurement · Category Manager · Purchasing Manager
Telematics & Tech     Fleet Systems Manager · Fleet Engineer · Head of Fleet Technology
Costs & Efficiency    Fleet Controller · Fleet Administrator · Commercial Manager
```

### Tier 3 — capital and pipeline

```
Head of Asset Management · Asset Manager · Capital Projects Manager
Head of Infrastructure · Estates Manager · Facilities Director
```

Depot charging is a groundworks-and-grid-connection project, not a vehicle
purchase, so it is signed off by people who have never read a fleet magazine.

### Tier 4 — the reward and benefits trade. Worth having, and no fleet title serves them.

```
Head of Reward · Reward Manager · Benefits Manager · Employee Benefits Consultant
HR Director · People Director
```

Salary sacrifice is the fastest-growing part of the leasing sector (BVRLA), and
51% of company cars are now fully electric. The person choosing that scheme
usually sits in HR, not fleet, and every fleet title in the market talks past
them.

---

## Company filters

**Industry:** Transportation, Trucking & Railroad · Logistics & Supply Chain ·
Construction · Civil Engineering · Utilities · Facilities Services ·
Environmental Services & Waste · Wholesale · Telecommunications ·
Mechanical or Industrial Engineering · Government Administration ·
Hospital & Health Care

**Keywords:** `fleet`, `HGV`, `LCV`, `commercial vehicles`, `haulage`,
`distribution`, `O-licence`, `logistics`

**Headcount:** 50-10,000 as the main band. **Also take 10-50** in transport,
haulage, plant hire, construction and waste — a 30-person haulier can run 40
vehicles and is exactly our reader. Below 10 there is no fleet budget.

**Geography: United Kingdom only, and unlike Golf this is not a priority order.**
The entire editorial proposition is UK tax and UK regulation — benefit in kind,
O-licensing, DVSA, the ZEV mandate, HMRC advisory fuel rates. A German fleet
manager has no use for any of it. Do not let Apollo widen this.

---

## Exclusions

- **Generic inboxes** — `info@`, `sales@`, `enquiries@`. No person, no
  engagement, highest complaint risk.
- **Competitor publishers** — Bauer Media, Stag Publications / Fleet World.
- **Sole traders and partnerships**, where Apollo can tell. Legal filter, see below.

**Fleet suppliers are not an exclusion.** Leasing companies, telematics vendors,
rental firms, fuel cards, OEM fleet teams — they read the trade press and they
are our advertiser list. Keep them, but ask for them **flagged in their own
column** so they never inflate the "fleet decision-makers" number we quote.

---

## Non-negotiables on data quality

- **Apollo "Verified" email status only.** Not "Guessed", not "Likely".
  `thefleetmagazine.co.uk` is a **six-day-old sending domain with no
  reputation** — a first send bouncing above 2% does lasting damage.
- **First name and company domain required** on every row.
- **Include Apollo's own email-status column** so we can audit what we were given.

---

## Legal, and it changes the brief

- **Corporate subscribers** (Ltd, PLC, LLP) may be emailed for B2B marketing
  without prior consent under PECR. **Sole traders and partnerships may not** —
  they count as individuals. Hence the exclusion above.
- **Article 14 applies**: third-party sourced data means people must be told
  where we got their details within a month of first contact. One line in the
  first email plus a privacy-policy section.
- Every send carries a working opt-out. The app already issues signed
  unsubscribe tokens.

---

## Export columns

```
email, first_name, last_name, title, company, company_country,
domain, industry, employee_count, seniority, apollo_email_status,
is_fleet_supplier
```

First eight map straight onto `NewsletterProspect`. Last three are for ranking,
tagging and audit.

---

## After the CSV

Import → rank → MillionVerifier → tranched into Mailchimp, smallest first, to
warm the domain. Nothing goes to the whole list at once. Same pipeline that took
Smart SME to 24,678 without burning its domain.

**One dependency that is not Lucas's:** Fleet has no Mailchimp audience yet and
its sending domain is not authenticated. Both are needed before tranche one
moves, and both can start now.
