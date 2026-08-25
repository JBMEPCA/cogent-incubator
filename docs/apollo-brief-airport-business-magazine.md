# Apollo brief: Airport Business Magazine

For Lucas. Target: **5,000-8,000 verified airport decision-makers, worldwide**, CSV.

---

## Before the titles: the filter that decides whether this works

Aviation has two populations and Apollo will hand over the wrong one by default.

| | Size |
|---|---|
| Airport operator decision-makers — buy, build and run the airport itself | tens of thousands globally (ACI's 811 members run ~2,200 airports; ~450 US airports are independent city/authority buyers) |
| Everyone else Apollo files under "aviation" — airline staff, pilots, cabin crew, travel trade, airport retail floor staff | **millions** |

Apollo's Airlines/Aviation industry code is airline-dominated, and a keyword
match on "airport" catches every barista and duty-free assistant who works AT
one. Neither buys anything for an airport. The benchmark for a tight list is
Passenger Terminal World's ABC-audited circulation: **9,570** print copies for
the whole global sector. A tight 5,000 beats a loose 30,000. **Do not ask for
volume, and do not accept airline job titles.**

The reliable anchor is the **company, not the keyword**: employer name contains
"airport", "airports", "airport authority", "aviation authority", or is one of
the named operator groups below. Start there and widen only if thin.

---

## Job titles

Apollo matches these as free text, so give Lucas the list and let it fuzzy-match.

### Tier 1 — the people who sign things (highest value, get these first)

```
Airport Director · Managing Director · Chief Executive · Airport Manager
Airport General Manager · Chief Operating Officer · Chief Commercial Officer
Director of Aviation · Aviation Director · Executive Director (airport authority)
```

Director of Aviation sits in Tier 1 because in the US model it IS the airport
CEO: ~450 US airports are city/county/authority departments, and the person
running LAX or Denver carries a municipal title, not a corporate one. This is
also why Government Administration is in the industry filter — exclude it and
the entire US market disappears.

### Tier 2 — department heads. These map onto our seven sections, which is the point: each one is a section, and each section is a sponsorship slot.

```
Revenue & Commercial       Commercial Director · Head of Commercial · Concessions Manager · Head of Retail · Airport Property Manager · Parking Manager
Expansion & Construction   Capital Projects Director · Programme Director · Head of Infrastructure · Chief Development Officer · Planning Director
Technology & Systems       CIO · CTO · Head of IT · Airport Systems Manager · Head of Innovation · Head of Digital
Operations & Resilience    Operations Director · Head of Airside Operations · Terminal Manager · Head of Terminal Operations · Head of Security · Business Continuity Manager
Route Development          Head of Route Development · Aviation Development Director · Air Service Development Manager · Head of Aviation Marketing
Sustainability & Energy    Head of Sustainability · Environment Manager · Energy Manager · Head of Decarbonisation
```

### Tier 3 — the group HQs and the money

```
Head of Asset Management · Investment Director · Head of Airport Investments
Chief Financial Officer · Finance Director (airport companies only)
```

~20 ownership groups control several hundred airports with centralised
procurement — AENA, VINCI Airports, Groupe ADP, Fraport, TAV, Corporación
América, AviAlliance, GMR, Adani, Schiphol, Avinor, Swedavia, MAG, daa, Changi,
Incheon, AOT. One HQ contact at these is worth ten station-level ones. Give
Lucas this list of employers by name.

### Tier 4 — the delivery trade. Worth having, and no airport title serves them as readers.

```
Aviation Sector Director · Head of Aviation · Aviation Market Lead
Aviation Business Development Director (at engineering, architecture and construction firms)
```

The people at AECOM, Arup, Jacobs, Mace, AtkinsRéalis, Mott MacDonald, Foster +
Partners and Grimshaw who chase the $2.4tn pipeline. Our expansion tracker and
tender coverage is written for exactly them, every incumbent treats them as
advertisers rather than readers, and they are both.

---

## Company filters

**Anchor filter (use first): company name contains** `airport` · `airports` ·
`airport authority` · `aviation authority` · `aerodrome` — plus the named
operator groups in Tier 3 and the delivery firms in Tier 4.

**Industry (secondary, always paired with a title from the lists above):**
Aviation & Aerospace · Airlines/Aviation · Government Administration ·
Civil Engineering · Construction · Architecture & Planning ·
Facilities Services

**Keywords:** `airport operations`, `airside`, `terminal`, `airfield`,
`airport development`, `route development`, `ground handling`

**Headcount:** 50-10,000+ as the main band. **Also take 10-50 where the company
name contains "airport"** — a regional airport with 30 staff still has a
director who buys runway lighting and screening. Below 10 is a flying club.

**Geography: global, in priority order — unlike Fleet, exactly like Golf.**

1. UK & Ireland
2. North America
3. Western Europe
4. Gulf (UAE, Saudi Arabia, Qatar)
5. Australia, New Zealand, Singapore, Hong Kong
6. Rest of world only if the count is thin

English-language title, so English-working markets first; the Gulf ranks above
its size because that is where the construction money is.

---

## Exclusions

- **Airline job titles** — pilot, cabin crew, flight attendant, first officer,
  flight ops, crew scheduling, and airline commercial roles generally. Airlines
  are the airport's customer, not our reader. (Exception already covered above:
  none for v1 — airline network planners can be a later, separate list.)
- **Airport retail and hospitality floor staff** — store manager, barista,
  sales assistant at an airport address.
- **Travel trade** — travel agents, tour operators, TMCs.
- **Generic inboxes** — `info@`, `sales@`, `enquiries@`. No person, no
  engagement, highest complaint risk.
- **Competitor publishers** — Russell Publishing (International Airport
  Review), UKi Media & Events (Passenger Terminal), GlobalData/Verdict (Airport
  Technology), a2b Global Media (Airport Industry-News), Aviation Media
  (Airport World), Moodie Davitt Report, TR Business, DFNI, Informa/Routes.
- **Sole traders and partnerships** on UK rows, where Apollo can tell. Legal
  filter, see below.

**Airport suppliers are not an exclusion.** Baggage handling, screening,
biometrics, GSE, airfield lighting, ops software, seating, FIDS, parking
systems, retail operators, ground handlers — they read the trade press and they
are our advertiser list (~1,900 exhibition stands sold across the sector's six
shows last year). Keep them, but ask for them **flagged in their own column**
so they never inflate the "airport decision-makers" number we quote.

---

## Non-negotiables on data quality

- **Apollo "Verified" email status only.** Not "Guessed", not "Likely".
  `airportbusinessmagazine.com` was registered **today** — a sending domain
  with zero reputation. A first send bouncing above 2% does lasting damage,
  and this domain has even less history than Fleet's did.
- **First name and company domain required** on every row.
- **`company_country` required on every row** — the tranching and the legal
  handling below both depend on it.
- **Include Apollo's own email-status column** so we can audit what we were given.

---

## Legal, and on a global list it changes the brief more than it did for Fleet

- **UK**: corporate subscribers (Ltd, PLC, LLP) may be emailed for B2B
  marketing without prior consent under PECR; sole traders and partnerships
  may not. Hence the exclusion above.
- **EU**: B2B email rules vary by member state — some (Germany, Austria,
  Italy) effectively require opt-in even for corporate addresses. EU rows go in
  their own tranche and we take advice per market before it moves; nothing EU
  goes in tranche one.
- **US**: CAN-SPAM is an opt-out regime — straightforward, but every send
  needs the postal address and a working opt-out (the app already issues
  signed unsubscribe tokens).
- **Canada**: CASL is the strictest regime on the list. Canadian rows are
  delivered in the CSV but **held out of email entirely** until decided
  separately.
- **Article 14 applies everywhere GDPR does**: third-party sourced data means
  people must be told where we got their details within a month of first
  contact. One line in the first email plus a privacy-policy section.

---

## Export columns

```
email, first_name, last_name, title, company, company_country,
domain, industry, employee_count, seniority, apollo_email_status,
is_airport_supplier
```

First eight map straight onto `NewsletterProspect`. Last three are for ranking,
tagging and audit. `company_country` drives the legal tranching above.

---

## After the CSV

Import → rank → MillionVerifier → tranched into Mailchimp, smallest first,
UK/US first (see legal), to warm the domain. Nothing goes to the whole list at
once. Same pipeline that took Smart SME to 24,678 without burning its domain.

**Two dependencies that are not Lucas's:** Airport Business Magazine has no
Mailchimp audience yet (must be named exactly `Airport Business Magazine`), and
`news.airportbusinessmagazine.com` is not authenticated as a sending domain —
the domain itself was only registered today. Both are JB steps 4-5 on the
launch tracker, both are needed before tranche one moves, and both can start
now.
