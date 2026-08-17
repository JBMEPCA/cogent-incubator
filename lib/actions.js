"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, forSite } from "./prisma";
import { signIn, signOut } from "./auth";
import { SLOTS } from "./schedule";

// ---------------------------------------------------------------- site scope
//
// Every action that touches a tenanted table needs to know which title it is
// acting on, and a server action has no route params to read it from.
//
// The site is therefore BOUND at the call site:
//
//   <form action={addTodo.bind(null, siteRef)}>
//
// where siteRef is `{ id, slug }` from the page's site context. Next serialises
// and signs bound arguments, so unlike a hidden form field this cannot be
// edited in devtools to point an action at another title. That property is the
// whole reason for choosing binding over `<input type="hidden" name="siteId">`,
// which would have been less work and quietly forgeable.
//
// authenticate() and logout() are the only actions without a site: sign-in is
// fleet-wide, and there is one user across the whole portfolio.

/** Paths to revalidate for a title, given the bound site reference. */
const sitePath = (site, sub = "") => `/s/${site.slug}${sub}`;

export async function authenticate(formData) {
  // signIn THROWS on failure in Auth.js v5 — it does not return { error }. The
  // old `if (result?.error)` check could never fire, so a bad password and an
  // unreachable database both escaped as an unhandled CallbackRouteError and
  // rendered a stack trace over the sign-in form.
  //
  // The two cases need different words, too: "wrong username or password" sends
  // someone hunting for a typo when the real problem is that the database is
  // down, which is not their fault and not fixable from this screen.
  let outcome = "ok";

  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (err) {
    // redirect() signals by throwing. Swallowing that would break navigation.
    if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) throw err;

    if (err?.type === "CredentialsSignin") {
      outcome = "bad";
    } else {
      outcome = "down";
      // The cause carries the useful line ("Can't reach database server at
      // localhost:5432"); the wrapper on its own says nothing actionable.
      console.error("[auth] sign-in failed:", err?.cause?.err?.message || err?.message || err);
    }
  }

  if (outcome === "bad") redirect("/login?error=1");
  if (outcome === "down") redirect("/login?error=server");
  redirect("/");
}

export async function logout() {
  await signOut({ redirect: false });
  redirect("/login");
}

// ---------- To-dos ----------

export async function addTodo(site, formData) {
  const title = formData.get("title")?.trim();
  if (!title) return;
  const dueRaw = formData.get("dueDate");
  await forSite(site.id).todo.create({
    data: {
      title,
      phase: formData.get("phase") || "general",
      dueDate: dueRaw ? new Date(dueRaw) : null,
    },
  });
  revalidatePath(sitePath(site));
}

export async function toggleTodo(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  // findUnique through the scoped client verifies ownership before returning,
  // so a to-do id belonging to another title reads as "not found" rather than
  // being toggled.
  const todo = await db.todo.findUnique({ where: { id } });
  if (!todo) return;
  await db.todo.update({
    where: { id },
    data: {
      done: !todo.done,
      completedAt: todo.done ? null : new Date(),
    },
  });
  revalidatePath(sitePath(site));
}

export async function deleteTodo(site, formData) {
  await forSite(site.id).todo.delete({ where: { id: formData.get("id") } });
  revalidatePath(sitePath(site));
}

// ---------- CRM ----------

function leadDataFromForm(formData) {
  const opt = (name) => {
    const v = formData.get(name)?.trim();
    return v ? v : null;
  };
  const valueRaw = formData.get("offerValue");
  return {
    company: formData.get("company")?.trim(),
    contactName: opt("contactName"),
    email: opt("email"),
    phone: opt("phone"),
    website: opt("website"),
    stage: formData.get("stage") || "prospect",
    product: formData.get("product") || null,
    offerValue: valueRaw ? parseFloat(valueRaw) : null,
    // Unchecked checkboxes send nothing, so only trust the checkbox when the
    // form declares it was present; forms without it default to per-month.
    perMonth: formData.has("perMonthPresent") ? formData.get("perMonth") === "on" : true,
    lastContacted: formData.get("lastContacted") ? new Date(formData.get("lastContacted")) : null,
    nextFollowUp: formData.get("nextFollowUp") ? new Date(formData.get("nextFollowUp")) : null,
    notes: opt("notes"),
  };
}

export async function addLead(site, formData) {
  const db = forSite(site.id);
  const data = leadDataFromForm(formData);
  if (!data.company) return;
  await db.lead.create({ data });
  revalidatePath(sitePath(site, "/crm"));
  revalidatePath(sitePath(site));
}

export async function updateLead(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const data = leadDataFromForm(formData);
  if (!data.company) return;
  await db.lead.update({ where: { id }, data });
  revalidatePath(sitePath(site, "/crm"));
  revalidatePath(sitePath(site, `/crm/${id}`));
  revalidatePath(sitePath(site));
  redirect(sitePath(site, "/crm"));
}

export async function markContacted(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return;
  await db.lead.update({
    where: { id },
    data: {
      lastContacted: new Date(),
      stage: lead.stage === "prospect" ? "contacted" : lead.stage,
    },
  });
  revalidatePath(sitePath(site, "/crm"));
  revalidatePath(sitePath(site));
}

export async function deleteLead(site, formData) {
  const db = forSite(site.id);
  await db.lead.delete({ where: { id: formData.get("id") } });
  revalidatePath(sitePath(site, "/crm"));
  revalidatePath(sitePath(site));
  redirect(sitePath(site, "/crm"));
}

// ---------- PR brands ----------

export async function addPrBrand(site, formData) {
  const db = forSite(site.id);
  const name = formData.get("name")?.trim();
  if (!name) return;
  const opt = (k) => formData.get(k)?.trim() || null;
  await db.prBrand.create({
    data: {
      name,
      website: opt("website"),
      category: opt("category"),
      newsHubUrl: opt("newsHubUrl"),
      newsletterUrl: opt("newsletterUrl"),
      notes: opt("notes"),
    },
  });
  revalidatePath(sitePath(site, "/content"));
}

export async function togglePrSubscribed(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const brand = await db.prBrand.findUnique({ where: { id } });
  if (!brand) return;
  await db.prBrand.update({ where: { id }, data: { subscribed: !brand.subscribed } });
  revalidatePath(sitePath(site, "/content"));
}

export async function deletePrBrand(site, formData) {
  const db = forSite(site.id);
  await db.prBrand.delete({ where: { id: formData.get("id") } });
  revalidatePath(sitePath(site, "/content"));
}

// ---------- Advertiser prospects ----------

export async function addProspect(site, formData) {
  const db = forSite(site.id);
  const company = formData.get("company")?.trim();
  if (!company) return;
  const opt = (k) => formData.get(k)?.trim() || null;
  await db.advertiserProspect.create({
    data: {
      company,
      website: opt("website"),
      category: formData.get("category")?.trim() || "Other",
      rationale: opt("rationale"),
      suggestedProduct: formData.get("suggestedProduct") || null,
    },
  });
  revalidatePath(sitePath(site, "/advertisers"));
}

export async function deleteProspect(site, formData) {
  const db = forSite(site.id);
  await db.advertiserProspect.delete({ where: { id: formData.get("id") } });
  revalidatePath(sitePath(site, "/advertisers"));
}

// Copies a research prospect into the CRM pipeline and links the two records.
export async function promoteProspect(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const p = await db.advertiserProspect.findUnique({ where: { id } });
  if (!p || p.promotedLeadId) return;
  const lead = await db.lead.create({
    data: {
      company: p.company,
      website: p.website,
      stage: "prospect",
      product: p.suggestedProduct,
      notes: p.rationale ? `Prospect rationale: ${p.rationale}` : null,
    },
  });
  await db.advertiserProspect.update({
    where: { id },
    data: { promotedLeadId: lead.id },
  });
  revalidatePath(sitePath(site, "/advertisers"));
  revalidatePath(sitePath(site, "/crm"));
  revalidatePath(sitePath(site));
}

// ---------- Content engine ----------

export async function shortlistFeedItem(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const item = await db.feedItem.findUnique({ where: { id }, include: { brand: true } });
  if (!item || item.status === "shortlisted") return;
  await db.$transaction([
    db.feedItem.update({ where: { id }, data: { status: "shortlisted" } }),
    db.article.create({
      data: {
        title: item.title,
        type: "pr_rewrite",
        status: "idea",
        sourceItemId: item.id,
        sourceUrl: item.link,
      },
    }),
  ]);
  revalidatePath(sitePath(site, "/content"));
}

export async function dismissFeedItem(site, formData) {
  const db = forSite(site.id);
  await db.feedItem.update({
    where: { id: formData.get("id") },
    data: { status: "dismissed" },
  });
  revalidatePath(sitePath(site, "/content"));
}

export async function addArticleIdea(site, formData) {
  const db = forSite(site.id);
  const title = formData.get("title")?.trim();
  if (!title) return;
  await db.article.create({
    data: {
      title,
      type: "seo_original",
      status: "idea",
      keywords: formData.get("keywords")?.trim() || null,
    },
  });
  revalidatePath(sitePath(site, "/content"));
}

const ARTICLE_FLOW = ["idea", "drafting", "review", "approved", "published"];

export async function advanceArticle(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const article = await db.article.findUnique({ where: { id } });
  if (!article) return;
  const next = ARTICLE_FLOW[ARTICLE_FLOW.indexOf(article.status) + 1];
  if (!next) return;
  await db.article.update({
    where: { id },
    data: { status: next, ...(next === "published" ? { publishedAt: new Date() } : {}) },
  });
  revalidatePath(sitePath(site, "/content"));
}

export async function deleteArticle(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const article = await db.article.findUnique({ where: { id } });
  if (!article) return;
  await db.$transaction([
    ...(article.sourceItemId
      ? [
          db.feedItem.update({
            where: { id: article.sourceItemId },
            data: { status: "dismissed" },
          }),
        ]
      : []),
    db.article.delete({ where: { id } }),
  ]);
  revalidatePath(sitePath(site, "/content"));
}

export async function saveArticle(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const title = formData.get("title")?.trim();
  if (!title) return;
  await db.article.update({
    where: { id },
    data: { title, body: formData.get("body") || null, keywords: formData.get("keywords")?.trim() || null },
  });
  revalidatePath(sitePath(site, `/content/article/${id}`));
  revalidatePath(sitePath(site, "/content"));
}

export async function publishArticle(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const article = await db.article.findUnique({ where: { id } });
  if (!article || !article.body) return;
  const { isWordPressConfigured, publishToWordPress, uploadMedia, resolveCategory, authorForSite } =
    await import("./wordpress");
  const { stripEmDashes } = await import("./drafting");
  // Every WordPress call in this action was still on the single-title signature
  // and passed no credentials at all, so `isWordPressConfigured()` read an
  // undefined argument and returned false EVERY time. The whole block below was
  // dead: the Publish button in the control room skipped WordPress entirely and
  // then marked the article `published` with a null wpPostId, which reads as a
  // successful publish everywhere else in the app.
  const { siteCredentials } = await import("./site");
  const { creds } = await siteCredentials(site.id);
  const wp = creds.wordpress;
  let wpPostId = article.wpPostId;
  if (isWordPressConfigured(wp)) {
    let featuredMediaId;
    if (article.imageUrl) {
      try {
        // Final visual check at the moment of publication: Claude looks at the
        // actual pixels again. A picture that fails here is dropped, never risked.
        const { verifyImage } = await import("./qa");
        const check = await verifyImage({
          imageUrl: article.imageUrl,
          title: article.title,
          keyphrase: article.keyphrase,
        });
        if (check.ok) {
          const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
          const media = await uploadMedia(wp, {
            imageUrl: article.imageUrl,
            alt: check.altText || article.imageAlt,
            filename: slug,
          });
          featuredMediaId = media.id;
        }
      } catch {
        // Image failure shouldn't block publishing — post goes out without one.
      }
    }
    let body = stripEmDashes(article.body);
    if (article.imageCredit) {
      body += `\n<p><em style="font-size:0.85em">${article.imageCredit}</em></p>`;
    }
    const post = await publishToWordPress(wp, {
      title: stripEmDashes(article.title),
      body,
      status: "publish",
      featuredMediaId,
      categoryId: await resolveCategory(wp, article.category),
      keyphrase: article.keyphrase,
      metaDesc: article.metaDesc,
      authorId: await authorForSite(wp, site),
    });
    wpPostId = post.id;
  }
  await db.article.update({
    where: { id },
    data: { status: "published", publishedAt: new Date(), wpPostId },
  });
  revalidatePath(sitePath(site, `/content/article/${id}`));
  revalidatePath(sitePath(site, "/content"));
}

// ---------- SEO agent ----------

export async function approveSeoSuggestion(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const suggestion = await db.seoSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.status !== "pending") return;
  try {
    const { applySuggestion } = await import("./seo-agent");
    await applySuggestion(site, suggestion);
    await db.seoSuggestion.update({
      where: { id },
      data: { status: "applied", appliedAt: new Date(), error: null },
    });
  } catch (e) {
    await db.seoSuggestion.update({
      where: { id },
      data: { status: "failed", error: e.message },
    });
  }
  revalidatePath(sitePath(site, "/seo"));
}

export async function dismissSeoSuggestion(site, formData) {
  const db = forSite(site.id);
  await db.seoSuggestion.update({
    where: { id: formData.get("id") },
    data: { status: "dismissed" },
  });
  revalidatePath(sitePath(site, "/seo"));
}

export async function retrySeoSuggestion(site, formData) {
  const db = forSite(site.id);
  await db.seoSuggestion.update({
    where: { id: formData.get("id") },
    data: { status: "pending", error: null },
  });
  revalidatePath(sitePath(site, "/seo"));
}

// ---------- LinkedIn engine ----------

export async function addLinkedInPost(site, formData) {
  const db = forSite(site.id);
  const text = formData.get("text")?.trim();
  if (!text) return;
  await db.linkedInPost.create({ data: { text } });
  revalidatePath(sitePath(site, "/linkedin"));
}

// Approving is the human gate, and now the trigger too: an approved post gets a
// slot and the cron publishes it when that slot arrives. With LinkedIn not
// connected this behaves exactly as it always did, so the queue still works as
// a copy-and-paste list.
export async function advanceLinkedInPost(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const post = await db.linkedInPost.findUnique({ where: { id } });
  if (!post) return;
  const next = post.status === "draft" ? "approved" : post.status === "approved" ? "posted" : null;
  if (!next) return;

  const data = { status: next };
  if (next === "approved") {
    const { getConnection, nextPostingSlot } = await import("./linkedin");
    const connection = await getConnection(site);
    if (connection && !connection.expired) {
      data.scheduledFor = await nextPostingSlot(site);
      data.publishError = null;
      data.attempts = 0;
    }
  } else {
    // "Mark posted" is the manual path: it records that you posted it by hand,
    // so the slot has to go with it or the cron would post it a second time.
    data.postedAt = new Date();
    data.scheduledFor = null;
  }

  await db.linkedInPost.update({ where: { id }, data });
  revalidatePath(sitePath(site, "/linkedin"));
}

// Skip the slot and publish immediately.
export async function postLinkedInNow(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const post = await db.linkedInPost.findUnique({ where: { id } });
  if (!post || post.status === "posted") return;

  const { publishPost } = await import("./linkedin");

  try {
    const result = await publishPost(site, post);
    await db.linkedInPost.update({
      where: { id },
      data: {
        status: "posted",
        postedAt: new Date(),
        linkedinUrn: result.urn,
        scheduledFor: null,
        publishError: null,
      },
    });
  } catch (e) {
    // Failures are written to the row rather than thrown: a server action that
    // throws shows a blank error page and loses the reason.
    await db.linkedInPost.update({ where: { id }, data: { publishError: e.message.slice(0, 500) } });
  }
  revalidatePath(sitePath(site, "/linkedin"));
}

// Three failures park a post. This is the way back in once the cause is fixed.
export async function retryLinkedInPost(site, formData) {
  const db = forSite(site.id);
  const { nextPostingSlot } = await import("./linkedin");
  await db.linkedInPost.update({
    where: { id: formData.get("id") },
    data: { attempts: 0, publishError: null, scheduledFor: await nextPostingSlot(site) },
  });
  revalidatePath(sitePath(site, "/linkedin"));
}

export async function disconnectLinkedIn(site) {
  const db = forSite(site.id);
  const { disconnect } = await import("./linkedin");
  await disconnect();
  revalidatePath(sitePath(site, "/linkedin"));
}

export async function deleteLinkedInPost(site, formData) {
  const db = forSite(site.id);
  await db.linkedInPost.delete({ where: { id: formData.get("id") } });
  revalidatePath(sitePath(site, "/linkedin"));
}

// ---------- Backlink outreach ----------

// Edit before it goes. The queue is the only place an outreach email can be
// changed, and every field a human is likely to want to fix is editable here:
// the address the agent guessed, the subject, and the body itself.
export async function saveOutreachEmail(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const row = await db.outreachEmail.findUnique({ where: { id } });
  if (!row || ["sent", "linked", "replied"].includes(row.status)) return;
  const contactEmail = formData.get("contactEmail")?.trim() || null;
  await db.outreachEmail.update({
    where: { id },
    data: {
      contactEmail,
      contactName: formData.get("contactName")?.trim() || null,
      subject: formData.get("subject")?.trim() || row.subject,
      body: formData.get("body")?.trim() || row.body,
    },
  });

  // An address typed in by hand is the only kind the engine treats as certain,
  // and it is a fact about the brand rather than about this one email. Writing
  // it back to the brand is what unblocks every future article naming them,
  // rather than making JB retype it each time.
  if (contactEmail && contactEmail !== row.contactEmail && row.brandId) {
    await db.prBrand.update({
      where: { id: row.brandId },
      data: {
        prContactEmail: contactEmail,
        contactConfidence: "confirmed",
        contactCheckedAt: new Date(),
      },
    });
  }
  revalidatePath(sitePath(site, "/outreach"));
}

// The human gate, and the trigger. Approving sends it, because an email you
// have just read and approved should not then sit in a queue for an hour.
export async function approveOutreachEmail(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const row = await db.outreachEmail.findUnique({ where: { id } });
  // "bounced" is approvable again: the fix for one is a new address, and then it
  // is the same email to the same brand about the same article.
  if (!row || !["pending", "approved", "failed", "bounced"].includes(row.status)) return;
  if (!row.contactEmail) {
    await db.outreachEmail.update({
      where: { id },
      data: { status: "failed", error: "No contact address. Add one and try again." },
    });
    revalidatePath(sitePath(site, "/outreach"));
    return;
  }

  await db.outreachEmail.update({ where: { id }, data: { status: "approved", error: null } });
  try {
    const { sendOutreachEmail } = await import("./outreach");
    await sendOutreachEmail(site, id);
  } catch {
    // sendOutreachEmail has already written the reason to the row. Swallowing
    // the throw here keeps the queue on screen instead of an error page.
  }
  revalidatePath(sitePath(site, "/outreach"));
}

// "I have checked it, that address is right."
//
// Needed because the send path refuses a guessed address, and typing the same
// address back into the box is not a change, so there would otherwise be no way
// to clear a guess that happens to be correct short of inventing a difference.
export async function confirmOutreachContact(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const row = await db.outreachEmail.findUnique({ where: { id } });
  const email = formData.get("contactEmail")?.trim() || row?.contactEmail;
  if (!row?.brandId || !email) return;
  await db.outreachEmail.update({ where: { id }, data: { contactEmail: email } });
  await db.prBrand.update({
    where: { id: row.brandId },
    data: { prContactEmail: email, contactConfidence: "confirmed", contactCheckedAt: new Date() },
  });
  revalidatePath(sitePath(site, "/outreach"));
}

export async function dismissOutreachEmail(site, formData) {
  const db = forSite(site.id);
  await db.outreachEmail.update({
    where: { id: formData.get("id") },
    data: { status: "dismissed" },
  });
  revalidatePath(sitePath(site, "/outreach"));
}

export async function retryOutreachEmail(site, formData) {
  const db = forSite(site.id);
  await db.outreachEmail.update({
    where: { id: formData.get("id") },
    data: { status: "pending", error: null },
  });
  revalidatePath(sitePath(site, "/outreach"));
}

// Someone replied asking to be left alone. This is the button for that, and it
// binds the brand, not the email: they never hear from the engine again.
export async function optOutBrand(site, formData) {
  const db = forSite(site.id);
  const brandId = formData.get("brandId");
  if (!brandId) return;
  await db.prBrand.update({
    where: { id: brandId },
    data: { optedOut: true, optedOutAt: new Date() },
  });
  await db.outreachEmail.updateMany({
    where: { brandId, status: { in: ["pending", "approved", "failed"] } },
    data: { status: "dismissed" },
  });
  revalidatePath(sitePath(site, "/outreach"));
}

// The link check only sees links on a brand's own news page. Coverage lands in
// plenty of places it cannot reach, so the result can be recorded by hand.
export async function markOutreachLinked(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  const url = formData.get("linkUrl")?.trim() || null;
  await db.outreachEmail.update({
    where: { id },
    data: { status: "linked", linkedAt: new Date(), linkUrl: url },
  });
  revalidatePath(sitePath(site, "/outreach"));
}

export async function markOutreachReplied(site, formData) {
  const db = forSite(site.id);
  await db.outreachEmail.update({
    where: { id: formData.get("id") },
    data: { status: "replied" },
  });
  revalidatePath(sitePath(site, "/outreach"));
}

// Manual sweep, for when an article has just gone out and you do not want to
// wait for the six-hourly pass.
export async function scanForMentionsNow(site) {
  const { runBacklinkOutreach, isOutreachConfigured } = await import("./outreach");
  const { siteCredentials } = await import("./site");
  const { creds } = await siteCredentials(site.id);
  if (!isOutreachConfigured(creds)) return;
  try {
    await runBacklinkOutreach(site, creds);
  } catch {}
  revalidatePath(sitePath(site, "/outreach"));
}

// ---------- Launch tracker ----------

// ---------- Costs ----------

export async function updateFixedCost(site, formData) {
  const db = forSite(site.id);
  const key = formData.get("key");
  const monthlyUsd = Number(formData.get("monthlyUsd"));
  if (!key || !Number.isFinite(monthlyUsd) || monthlyUsd < 0) return;

  const { getFixedCosts, saveFixedCosts } = await import("./agents/costs");
  const items = await getFixedCosts(site.id);
  const next = items.map((i) =>
    // Once a figure is set by hand it is no longer awaiting confirmation.
    i.key === key ? { ...i, monthlyUsd, confirm: false } : i
  );
  await saveFixedCosts(site.id, next);
  revalidatePath(sitePath(site, "/engine-room/costs"));
}

export async function updateCostTarget(site, formData) {
  const db = forSite(site.id);
  const targetGbp = Number(formData.get("targetGbp"));
  if (!Number.isFinite(targetGbp) || targetGbp <= 0) return;
  const { saveSetting, TARGET_KEY } = await import("./agents/costs");
  await saveSetting(site.id, TARGET_KEY, targetGbp);
  revalidatePath(sitePath(site, "/engine-room/costs"));
}

// ---------- Content suggestions ----------

// An idea from JB, dropped straight into the Researcher's queue. Kept as a
// ResearchTopic rather than an Article so it goes through the Director like any
// other topic, but flagged `source: "jb"` — the Director commissions these
// ahead of everything else and is not allowed to strike them out.
export async function suggestTopic(site, formData) {
  const db = forSite(site.id);
  const title = formData.get("title")?.trim();
  if (!title) return;
  const brief = formData.get("brief")?.trim() || null;
  await db.researchTopic.create({
    data: {
      title: title.slice(0, 300),
      source: "jb",
      query: brief,
      rationale: "Requested by JB",
      score: 100,
      status: "proposed",
    },
  });
  revalidatePath(sitePath(site, "/engine-room"));
}

export async function withdrawSuggestion(site, formData) {
  const db = forSite(site.id);
  const id = formData.get("id");
  if (!id) return;
  // Scoped so this can only ever remove one of JB's own untouched suggestions,
  // never a topic the Researcher found or one already being written.
  await db.researchTopic.deleteMany({ where: { id, source: "jb", status: "proposed" } });
  revalidatePath(sitePath(site, "/engine-room"));
}

// Hand the queue to the Director now rather than waiting for the next hourly
// tick. Manual wakes work outside operating hours by design.
export async function wakeDirectorNow(site) {
  const db = forSite(site.id);
  const { ensureAgents } = await import("./agents/runtime");
  const { runDirector } = await import("./agents/team");
  await ensureAgents(site.id);
  try {
    await runDirector(site, "manual");
  } catch {
    // The run records its own failure; the suggestion is already saved and will
    // be picked up on the next tick regardless.
  }
  revalidatePath(sitePath(site, "/engine-room"));
}

// ---------- Credentials ----------
//
// Values arrive over a server action, are encrypted in saveCredential() and are
// never read back into a page. A blank field on a kind that is already stored
// means "leave this one alone" rather than "clear it": a form that shows
// •••••••• for a password and then wipes it on save because the user only came
// to fix the URL is the single most annoying way this screen could behave.

export async function saveSiteCredential(site, kind, formData) {
  const { CREDENTIAL_KINDS, saveCredential, siteCredentials } = await import("./site");
  const spec = CREDENTIAL_KINDS[kind];
  if (!spec) return;

  const { creds } = await siteCredentials(site.id);
  const existing = creds[kind] || {};

  const payload = {};
  for (const field of spec.fields) {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    payload[field] = value || existing[field] || null;
  }

  await saveCredential(site.id, kind, payload);
  await testSiteCredential(site, kind);
}

export async function testSiteCredential(site, kind) {
  const { siteCredentials, recordCredentialHealth } = await import("./site");
  const { probeCredential } = await import("./probe");

  const { creds } = await siteCredentials(site.id);
  const result = await probeCredential(kind, creds[kind]);

  await recordCredentialHealth(site.id, kind, {
    healthy: result.ok,
    // A pass with a caveat is still a pass, but the caveat is the useful half,
    // so it rides in lastError rather than being dropped on the floor.
    error: result.ok ? result.warning : result.error,
  });
  revalidatePath(sitePath(site, "/settings"));
}

export async function clearSiteCredential(site, formData) {
  const kind = formData.get("kind");
  const { CREDENTIAL_KINDS } = await import("./site");
  if (!CREDENTIAL_KINDS[kind]) return;
  await forSite(site.id).siteCredential.deleteMany({ where: { kind } });
  revalidatePath(sitePath(site, "/settings"));
}

// ---------- Engine controls ----------

/**
 * The switches that decide whether a title's agents run at all, and how hard.
 *
 * These lived only in the database with no way to change them: engineEnabled was
 * read by every cron and written by nothing except title creation, so switching
 * a title on meant an UPDATE by hand. That is a poor place to keep the control
 * that starts spending money and publishing to a live site.
 *
 * Checkboxes are absent from formData when unticked, which is exactly the
 * semantics wanted here — each one is read as a plain boolean.
 */
export async function saveEngineSettings(site, formData) {
  const bool = (name) => formData.get(name) === "on";

  const capRaw = String(formData.get("dailySpendCapUsd") ?? "").trim();
  const cap = capRaw === "" ? null : Number(capRaw);
  const targetRaw = String(formData.get("articlesPerDayTarget") ?? "").trim();
  const target = targetRaw === "" ? undefined : Number(targetRaw);

  const hour = (name, fallback) => {
    const v = Number(String(formData.get(name) ?? "").trim());
    return Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback;
  };

  const start = hour("officeHoursStart", site.officeHoursStart);
  const end = hour("officeHoursEnd", site.officeHoursEnd);

  // Nothing in the app moved a title off `setup`, and lib/cron.js only picks up
  // titles whose status is `live` or `cold_start` — so a fully provisioned
  // title #2 would have sat with its engine ticked on and never run, with no
  // error anywhere to say why. Switching the engine on IS the human saying
  // provisioning is finished, so that is where the promotion belongs. It goes to
  // cold_start rather than live because a new domain has no Search Console
  // history; the Researcher promotes it the day real data arrives.
  const leavingSetup = bool("engineEnabled") && site.status === "setup";

  await prisma.site.update({
    where: { id: site.id },
    data: {
      ...(leavingSetup ? { status: "cold_start", launchedAt: site.launchedAt ?? new Date() } : {}),
      engineEnabled: bool("engineEnabled"),
      newsletterEnabled: bool("newsletterEnabled"),
      linkedInEnabled: bool("linkedInEnabled"),
      outreachEnabled: bool("outreachEnabled"),
      // A cap of zero would read as "uncapped" through a falsy check somewhere
      // downstream, so it is rejected here rather than stored as a trap.
      ...(cap !== null && Number.isFinite(cap) && cap > 0 ? { dailySpendCapUsd: cap } : { dailySpendCapUsd: null }),
      // Clamped to what the scheduler can actually honour. slotsFor() rounds and
      // caps at the seven slots in the day, so storing 40 here would show 40 in
      // Settings while the engine quietly published seven — a setting that lies
      // about itself is worse than no setting.
      ...(target !== undefined && Number.isFinite(target) && target > 0
        ? { articlesPerDayTarget: Math.max(1, Math.min(SLOTS.length, Math.round(target))) }
        : {}),
      // An end before the start would silently mean "never run".
      ...(end > start ? { officeHoursStart: start, officeHoursEnd: end } : {}),
    },
  });

  revalidatePath(sitePath(site, "/settings"));
  revalidatePath(sitePath(site));
}

/**
 * Tick a provisioning step off, or put it back.
 *
 * `SiteProvisioningStep` was a write-only table: the new-title wizard created
 * fourteen rows per title and nothing in the app ever read them, so the
 * checklist the wizard promises on the settings page did not exist. The steps
 * that matter are the ones nobody remembers — the SiteGround captcha returns
 * 202 and looks healthy, and a missing byline account publishes under the
 * Engine's name — so the list has to be somewhere you actually look.
 *
 * Deliberately a plain toggle with no ordering rules. These are real-world jobs
 * across half a dozen consoles and they genuinely do get done out of order; a
 * checklist that refuses step 6 until step 5 is ticked would just get lied to.
 */
export async function toggleProvisioningStep(site, formData) {
  const key = String(formData.get("key") || "");
  if (!key) return;

  // findFirst rather than findUnique on the compound key: forSite() injects the
  // siteId into `where` itself, and a caller-supplied siteId_key would collide
  // with that injection.
  const db = forSite(site.id);
  const step = await db.siteProvisioningStep.findFirst({ where: { key } });
  if (!step) return;

  await db.siteProvisioningStep.update({
    where: { id: step.id },
    data: { done: !step.done, doneAt: step.done ? null : new Date() },
  });

  revalidatePath(sitePath(site, "/settings"));
}
