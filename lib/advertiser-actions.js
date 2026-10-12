"use server";

import { revalidatePath } from "next/cache";
import { prisma, fleetRead } from "./prisma";
import { requireEditor } from "./permissions";
import { EMAIL_RE, FREE_MAIL, normaliseDomain, rowToRecord } from "./advertiser-csv";
import { OUTCOMES } from "./advertisers";

// The advertiser list (see Advertiser in the schema). Fleet-wide, so nothing
// here takes a bound site; titles come from the form and are checked against
// the Site table rather than trusted, as on the Black Book.

const PATH = "/advertisers";
const text = (fd, k) => fd.get(k)?.toString().trim() || "";
const PRODUCTS = new Set(["banner", "solus", "web_story", "newsletter", "multiple", "other"]);

/** "All titles" is stored as an empty list, as on the Black Book. */
async function readTitles(fd) {
  if (fd.get("allTitles") === "on") return [];
  const picked = fd.getAll("siteIds").map(String);
  if (!picked.length) return [];
  const rows = await prisma.site.findMany({ where: { id: { in: picked } }, select: { id: true } });
  return rows.map((r) => r.id);
}

// Either side being "all titles" wins; otherwise the union.
const mergeTitles = (a, b) => (a.length === 0 || b.length === 0 ? [] : [...new Set([...a, ...b])]);

/** Add one brand by hand, with an optional first contact. Returns { ok, message }. */
export async function addAdvertiser(_prev, fd) {
  await requireEditor();
  const company = text(fd, "company");
  const website = text(fd, "website");
  const email = text(fd, "email").toLowerCase();
  if (!company) return { ok: false, message: "Company is required." };
  if (email && !EMAIL_RE.test(email)) return { ok: false, message: "That email address doesn't look right." };

  const emailDomain = email ? email.split("@")[1] : null;
  if (emailDomain && FREE_MAIL.has(emailDomain)) {
    return { ok: false, message: "That's a personal address, which can't be emailed cold. Use their work email." };
  }
  const domain = normaliseDomain(website) || emailDomain;
  if (!domain) return { ok: false, message: "Add the brand's website, or a contact on its own email domain." };

  const siteIds = await readTitles(fd);
  const existing = await prisma.advertiser.findUnique({ where: { domain } });
  const adv = existing
    ? await prisma.advertiser.update({
        where: { id: existing.id },
        data: {
          siteIds: mergeTitles(existing.siteIds, siteIds),
          category: existing.category || text(fd, "category") || null,
          website: existing.website || website || null,
        },
      })
    : await prisma.advertiser.create({
        data: {
          company,
          domain,
          website: website || null,
          category: text(fd, "category") || null,
          siteIds,
          notes: text(fd, "notes") || null,
          sourceDetail: text(fd, "sourceDetail") || null,
        },
      });

  let contactNote = "";
  if (email) {
    const clash = await prisma.advertiserContact.findUnique({ where: { email }, select: { advertiserId: true } });
    if (clash) {
      contactNote = clash.advertiserId === adv.id ? " The contact was already on it." : ` ${email} is already listed under another brand, so it wasn't added.`;
    } else {
      await prisma.advertiserContact.create({
        data: {
          advertiserId: adv.id,
          email,
          firstName: text(fd, "firstName") || null,
          lastName: text(fd, "lastName") || null,
          jobTitle: text(fd, "jobTitle") || null,
        },
      });
    }
  }
  revalidatePath(PATH);
  return {
    ok: true,
    message: existing
      ? `${existing.company} (${domain}) was already on the list, so this was merged into it.${contactNote}`
      : `Added ${company}.${contactNote}`,
  };
}

/** Edit a brand's details in place. Titles are replaced, not merged. */
export async function updateAdvertiser(id, fd) {
  await requireEditor();
  const company = text(fd, "company");
  if (!company) return;
  await prisma.advertiser.update({
    where: { id: String(id) },
    data: {
      company,
      website: text(fd, "website") || null,
      category: text(fd, "category") || null,
      notes: text(fd, "notes") || null,
      siteIds: await readTitles(fd),
    },
  });
  revalidatePath(PATH);
}

export async function deleteAdvertiser(id) {
  await requireEditor();
  await prisma.advertiser.delete({ where: { id: String(id) } });
  revalidatePath(PATH);
}

export async function addContact(advertiserId, fd) {
  await requireEditor();
  const email = text(fd, "email").toLowerCase();
  // Personal mailboxes can't be emailed cold (see FREE_MAIL), so they're refused.
  if (!EMAIL_RE.test(email) || FREE_MAIL.has(email.split("@")[1])) return;
  const clash = await prisma.advertiserContact.findUnique({ where: { email } });
  if (clash) return;
  await prisma.advertiserContact.create({
    data: {
      advertiserId: String(advertiserId),
      email,
      firstName: text(fd, "firstName") || null,
      lastName: text(fd, "lastName") || null,
      jobTitle: text(fd, "jobTitle") || null,
      phone: text(fd, "phone") || null,
    },
  });
  revalidatePath(PATH);
}

export async function deleteContact(id) {
  await requireEditor();
  await prisma.advertiserContact.delete({ where: { id: String(id) } });
  revalidatePath(PATH);
}

/**
 * Record an offer sent by hand. Mail merges sent from the app will write the
 * same rows themselves; this is for anything sent outside it, so the "last
 * offer" date stays true either way.
 */
export async function logOffer(advertiserId, fd) {
  await requireEditor();
  const campaign = text(fd, "campaign") || "One-off";
  const product = text(fd, "product");
  const day = text(fd, "sentAt");
  const siteId = text(fd, "siteId");
  const contactId = text(fd, "contactId");
  const site = siteId ? await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }) : null;
  const contact = contactId
    ? await prisma.advertiserContact.findFirst({ where: { id: contactId, advertiserId: String(advertiserId) }, select: { id: true } })
    : null;
  await prisma.advertiserOffer.create({
    data: {
      advertiserId: String(advertiserId),
      contactId: contact?.id || null,
      siteId: site?.id || null,
      campaign,
      product: PRODUCTS.has(product) ? product : null,
      hook: text(fd, "hook") || null,
      sentAt: day ? new Date(`${day}T09:00:00Z`) : new Date(),
    },
  });
  revalidatePath(PATH);
}

export async function setOfferOutcome(id, fd) {
  await requireEditor();
  const outcome = text(fd, "outcome");
  if (!OUTCOMES.some((o) => o.value === outcome)) return;
  await prisma.advertiserOffer.update({ where: { id: String(id) }, data: { outcome } });
  revalidatePath(PATH);
}

export async function deleteOffer(id) {
  await requireEditor();
  await prisma.advertiserOffer.delete({ where: { id: String(id) } });
  revalidatePath(PATH);
}

const MAX_ROWS = 1000;
const PERSONAL = "Personal email address (brand kept, person left off)";

/**
 * One chunk of a CSV import. The browser parses the file and sends the raw
 * rows plus its column mapping in chunks; every row is re-read here through
 * the same rowToRecord, so nothing the browser decided is taken on trust.
 *
 * Existing brands are merged (titles added, blanks filled), never overwritten.
 * Existing contacts are left as they are. Brands on the global opt-out list
 * are not added at all. Returns counts and the skip reasons.
 */
export async function importAdvertiserChunk({ rows, mapping, siteIds: rawSiteIds, allTitles, sourceDetail }) {
  await requireEditor();
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) {
    return { ok: false, message: `Send at most ${MAX_ROWS} rows at a time.` };
  }

  const known = !allTitles && Array.isArray(rawSiteIds) && rawSiteIds.length
    ? (await prisma.site.findMany({ where: { id: { in: rawSiteIds.map(String) } }, select: { id: true } })).map((s) => s.id)
    : [];
  if (!allTitles && known.length === 0) return { ok: false, message: "Pick at least one title, or All titles." };
  const siteIds = allTitles ? [] : known;
  const detail = String(sourceDetail || "").trim().slice(0, 200) || null;

  const skipped = {};
  const skip = (why) => (skipped[why] = (skipped[why] || 0) + 1);

  // Group by brand: one CSV often has several people at the same company.
  const brands = new Map();
  for (const row of rows) {
    const rec = rowToRecord(Array.isArray(row) ? row : [], mapping || {});
    if (rec.skip) {
      skip(rec.skip);
      continue;
    }
    if (rec.personalDropped) skip(PERSONAL);
    const b = brands.get(rec.domain) || { company: rec.company, domain: rec.domain, website: rec.website, category: rec.category, contacts: [] };
    b.website ||= rec.website;
    b.category ||= rec.category;
    if (rec.contact) b.contacts.push(rec.contact);
    brands.set(rec.domain, b);
  }

  const domains = [...brands.keys()];
  const optedOut = new Set(
    (await fleetRead().outreachOptOut.findMany({ where: { domain: { in: domains } }, select: { domain: true } })).map((r) => r.domain)
  );
  for (const d of optedOut) {
    skip("Opted out of our emails");
    brands.delete(d);
  }

  const existing = await prisma.advertiser.findMany({ where: { domain: { in: [...brands.keys()] } } });
  const byDomain = new Map(existing.map((a) => [a.domain, a]));

  let created = 0;
  let merged = 0;
  const fresh = [...brands.values()].filter((b) => !byDomain.has(b.domain));
  if (fresh.length) {
    const res = await prisma.advertiser.createMany({
      data: fresh.map((b) => ({
        company: b.company,
        domain: b.domain,
        website: b.website,
        category: b.category,
        siteIds,
        source: "csv",
        sourceDetail: detail,
      })),
      skipDuplicates: true,
    });
    created = res.count;
  }
  for (const a of existing) {
    const b = brands.get(a.domain);
    await prisma.advertiser.update({
      where: { id: a.id },
      data: {
        siteIds: mergeTitles(a.siteIds, siteIds),
        website: a.website || b.website,
        category: a.category || b.category,
      },
    });
    merged++;
  }

  // Contacts, now every brand has an id.
  const ids = new Map(
    (await prisma.advertiser.findMany({ where: { domain: { in: [...brands.keys()] } }, select: { id: true, domain: true } })).map((a) => [a.domain, a.id])
  );
  const seen = new Set();
  const contacts = [];
  for (const b of brands.values()) {
    for (const c of b.contacts) {
      if (seen.has(c.email)) continue;
      seen.add(c.email);
      contacts.push({ ...c, advertiserId: ids.get(b.domain), source: "csv" });
    }
  }
  const already = contacts.length
    ? (await prisma.advertiserContact.count({ where: { email: { in: contacts.map((c) => c.email) } } }))
    : 0;
  const added = contacts.length
    ? (await prisma.advertiserContact.createMany({ data: contacts.filter((c) => c.advertiserId), skipDuplicates: true })).count
    : 0;

  revalidatePath(PATH);
  return { ok: true, created, merged, contactsAdded: added, contactsExisting: already, skipped };
}

/**
 * Copy every title's research list (AdvertiserProspect) into the fleet list,
 * so the per-title lists built before this page existed are not stranded.
 * Rows without a website are left behind: there is no domain to key them on.
 */
export async function importResearchLists() {
  await requireEditor();
  const prospects = await fleetRead().advertiserProspect.findMany({
    select: { company: true, website: true, category: true, rationale: true, siteId: true },
  });
  const byDomain = new Map();
  let noSite = 0;
  for (const p of prospects) {
    const domain = normaliseDomain(p.website);
    if (!domain) {
      noSite++;
      continue;
    }
    const b = byDomain.get(domain) || { company: p.company, website: p.website, category: p.category, notes: p.rationale, siteIds: new Set() };
    b.siteIds.add(p.siteId);
    byDomain.set(domain, b);
  }
  const existing = await prisma.advertiser.findMany({ where: { domain: { in: [...byDomain.keys()] } } });
  const have = new Map(existing.map((a) => [a.domain, a]));
  let created = 0;
  for (const [domain, b] of byDomain) {
    const cur = have.get(domain);
    if (cur) {
      await prisma.advertiser.update({ where: { id: cur.id }, data: { siteIds: mergeTitles(cur.siteIds, [...b.siteIds]) } });
    } else {
      await prisma.advertiser.create({
        data: {
          company: b.company,
          domain,
          website: b.website,
          category: b.category,
          notes: b.notes,
          siteIds: [...b.siteIds],
          source: "prospect",
          sourceDetail: "Title research list",
        },
      });
      created++;
    }
  }
  revalidatePath(PATH);
  return { created, merged: byDomain.size - created, noSite };
}
