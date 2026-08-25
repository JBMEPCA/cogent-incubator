# Apollo brief: Barbering Business

For Lucas. Target: **2,500-5,000 verified UK barbering and male grooming
decision-makers**, CSV. This sector is smaller and far less incorporated than
Fleet — a tight 2,500 is a result, a loose 15,000 is a liability.

---

## Before the titles: the filter that decides whether this works

Barbering has two populations and Apollo will hand over the wrong one by default.

| | Who they are |
|---|---|
| Owners and operators — hold the lease, buy the kit, set the prices | ~18,400 shops (2025), 99% independent (LDC) |
| Individual barbers — employees and chair renters | The majority of the workforce: ~60% self-employed (NHBF) |

Apollo's default for "barber" is the person holding the clippers, not the
person holding the lease. Individual barbers buy almost nothing a shop doesn't
buy for them — and because most are **sole traders, PECR means we legally
cannot email them anyway** (see Legal). A list full of them is complaint risk
plus dead weight plus an audience figure we cannot honestly sell to
advertisers. **Do not ask for volume, and do not accept "Barber" as a job
title on its own.**

---

## Job titles

Apollo matches these as free text, so give Lucas the list and let it fuzzy-match.

### Tier 1 — the people who hold the lease (highest value, get these first)

```
Owner · Proprietor · Founder · Co-Founder · Barbershop Owner · Salon Owner
Managing Director · Director · General Manager · Shop Manager · Salon Manager
```

"Owner" in a company matching the keywords below is the core reader. A
"Master Barber" at a company where they are also listed as Owner/Director
counts; a Master Barber with no ownership signal is Tier none.

### Tier 2 — multi-site and franchise operations. Small in number, disproportionate in value: one contact controls many chairs.

```
Operations Manager · Operations Director · Area Manager · Regional Manager
Franchise Owner · Franchisee · Franchise Manager · Brand Manager
Finance Director (groups only)
```

The franchise and multi-site groups (Headcase, Gould Barbers, Mr Barbers, the
London multi-sites like Pall Mall Barbers and Ruffians) are where these live.
A 12-shop group is our single most valuable subscriber type.

### Tier 3 — education and training. No barbering title owns this audience.

```
Academy Director · Academy Owner · Head of Education · Education Manager
Training Manager · Barber Educator · Barbering Tutor · Lecturer (Barbering)
Head of Hairdressing & Barbering (FE colleges)
```

Every academy sends newly qualified barbers into the trade reading whatever
their tutors read, and FE colleges run barbering NVQs at scale. This is the
People & Training section's readership and its sponsorship audience in one.

### Tier 4 — the supply trade. Keep, but flagged: this is the advertiser list, not the reader count.

```
Sales Director · National Sales Manager · Key Account Manager
Trade Marketing Manager · Marketing Manager · Education Manager (brands)
Commercial Director (wholesalers, distributors, fit-out, booking platforms)
```

At companies like: Wahl UK, BaBylissPRO, Andis, JRL, StyleCraft, Denman, Kent
Brushes (tools) · Uppercut Deluxe, American Crew, Reuzel, Bluebeards Revenge,
Captain Fawcett, Slick Gorilla (product) · Salons Direct, Coolblades, Sally
(wholesale) · REM, Takara Belmont (chairs and fit-out) · Nearcut, Booksy,
Fresha, Squire (booking) · Salon Gold, PolicyBee (insurance).

---

## Company filters

**Industry:** Consumer Services · Cosmetics · Retail · Health, Wellness &
Fitness · Apparel & Fashion (Apollo files grooming brands inconsistently — the
keywords do the real work).

**Keywords:** `barber`, `barbershop`, `barbering`, `male grooming`,
`men's grooming`, `grooming lounge`, `turkish barber`, `gents hairdressing`,
`barber academy`, `barber supplies`

**Headcount:** the inverse of Fleet — **small IS the reader here.** Main band
2-50. Take 50-500 for groups, academies, brands and wholesalers. Headcount 1
is almost always a sole trader — skip unless Apollo shows an Ltd.

**Geography: United Kingdom only.** The editorial proposition is UK-specific —
VAT threshold, HMRC employment status for hair and beauty, NHBF, UK business
rates. Do not let Apollo widen this.

---

## Exclusions

- **Job title "Barber" / "Barber Stylist" / "Hair Stylist" with no ownership
  or management signal** — the chair-renter population. Wrong reader, and
  usually a sole trader we cannot legally email.
- **Generic inboxes** — `info@`, `bookings@`, `enquiries@`. In this sector
  `bookings@` is the shop's customer inbox; a marketing email there gets
  reported, not read.
- **Competitor publishers** — Modern Barber, BarberEVO, Professional Beauty
  Group (they run Barber Connect).
- **Sole traders and partnerships**, where Apollo can tell. Legal filter, see
  below — and in THIS sector it is the main event, not a footnote.
- **Nothing from Total Grooming's world.** CIM's Total Grooming is DOG
  grooming — different trade, different readers. The clipper brands overlap
  (Wahl, Andis sell both); the audiences must not.

**Grooming suppliers are not an exclusion.** They are Tier 4 and they are our
advertiser list — but ask for them **flagged in their own column** so they
never inflate the "barbershop owners" number we quote to those same
advertisers.

---

## Non-negotiables on data quality

- **Apollo "Verified" email status only.** Not "Guessed", not "Likely".
  `news.barberingbusiness.com` was authenticated **today** — this is the
  youngest sending domain in the fleet, with zero reputation. A first send
  bouncing above 2% does lasting damage we cannot undo.
- **First name and company domain required** on every row.
- **Include Apollo's own email-status column** so we can audit what we were given.

---

## Legal, and in this sector it IS the brief

- **Corporate subscribers** (Ltd, PLC, LLP) may be emailed for B2B marketing
  without prior consent under PECR. **Sole traders and partnerships may not** —
  they count as individuals. Barbering is majority self-employed, so this
  filter does more work here than on any other title. When in doubt about an
  entity, leave it out.
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
is_grooming_supplier
```

First eight map straight onto `NewsletterProspect`. Last three are for ranking,
tagging and audit.

---

## After the CSV

Import → rank → MillionVerifier → tranched into Mailchimp, smallest first, to
warm the domain. Nothing goes to the whole list at once. Same pipeline that took
Smart SME to 24,678 without burning its domain.

**Unlike Fleet's brief, there are no blockers on our side:** the `Barbering
Business` Mailchimp audience exists (id `35319dae03`) and
`news.barberingbusiness.com` is authenticated as of 24 Aug. Tranche one can
move as soon as the list is ranked and verified — but this domain is
day-one fresh, so the first tranche should be the smallest we have ever sent.
