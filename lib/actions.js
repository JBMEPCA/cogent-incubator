"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { signIn, signOut } from "./auth";

export async function authenticate(formData) {
  const result = await signIn("credentials", {
    username: formData.get("username"),
    password: formData.get("password"),
    redirect: false,
  });
  if (result?.error) {
    redirect("/login?error=1");
  }
  redirect("/");
}

export async function logout() {
  await signOut({ redirect: false });
  redirect("/login");
}

// ---------- To-dos ----------

export async function addTodo(formData) {
  const title = formData.get("title")?.trim();
  if (!title) return;
  const dueRaw = formData.get("dueDate");
  await prisma.todo.create({
    data: {
      title,
      phase: formData.get("phase") || "general",
      dueDate: dueRaw ? new Date(dueRaw) : null,
    },
  });
  revalidatePath("/");
}

export async function toggleTodo(formData) {
  const id = formData.get("id");
  const todo = await prisma.todo.findUnique({ where: { id } });
  if (!todo) return;
  await prisma.todo.update({
    where: { id },
    data: {
      done: !todo.done,
      completedAt: todo.done ? null : new Date(),
    },
  });
  revalidatePath("/");
}

export async function deleteTodo(formData) {
  await prisma.todo.delete({ where: { id: formData.get("id") } });
  revalidatePath("/");
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

export async function addLead(formData) {
  const data = leadDataFromForm(formData);
  if (!data.company) return;
  await prisma.lead.create({ data });
  revalidatePath("/crm");
  revalidatePath("/");
}

export async function updateLead(formData) {
  const id = formData.get("id");
  const data = leadDataFromForm(formData);
  if (!data.company) return;
  await prisma.lead.update({ where: { id }, data });
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  revalidatePath("/");
  redirect("/crm");
}

export async function markContacted(formData) {
  const id = formData.get("id");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;
  await prisma.lead.update({
    where: { id },
    data: {
      lastContacted: new Date(),
      stage: lead.stage === "prospect" ? "contacted" : lead.stage,
    },
  });
  revalidatePath("/crm");
  revalidatePath("/");
}

export async function deleteLead(formData) {
  await prisma.lead.delete({ where: { id: formData.get("id") } });
  revalidatePath("/crm");
  revalidatePath("/");
  redirect("/crm");
}

// ---------- PR brands ----------

export async function addPrBrand(formData) {
  const name = formData.get("name")?.trim();
  if (!name) return;
  const opt = (k) => formData.get(k)?.trim() || null;
  await prisma.prBrand.create({
    data: {
      name,
      website: opt("website"),
      category: opt("category"),
      newsHubUrl: opt("newsHubUrl"),
      newsletterUrl: opt("newsletterUrl"),
      notes: opt("notes"),
    },
  });
  revalidatePath("/content");
}

export async function togglePrSubscribed(formData) {
  const id = formData.get("id");
  const brand = await prisma.prBrand.findUnique({ where: { id } });
  if (!brand) return;
  await prisma.prBrand.update({ where: { id }, data: { subscribed: !brand.subscribed } });
  revalidatePath("/content");
}

export async function deletePrBrand(formData) {
  await prisma.prBrand.delete({ where: { id: formData.get("id") } });
  revalidatePath("/content");
}

// ---------- Advertiser prospects ----------

export async function addProspect(formData) {
  const company = formData.get("company")?.trim();
  if (!company) return;
  const opt = (k) => formData.get(k)?.trim() || null;
  await prisma.advertiserProspect.create({
    data: {
      company,
      website: opt("website"),
      category: formData.get("category")?.trim() || "Other",
      rationale: opt("rationale"),
      suggestedProduct: formData.get("suggestedProduct") || null,
    },
  });
  revalidatePath("/advertisers");
}

export async function deleteProspect(formData) {
  await prisma.advertiserProspect.delete({ where: { id: formData.get("id") } });
  revalidatePath("/advertisers");
}

// Copies a research prospect into the CRM pipeline and links the two records.
export async function promoteProspect(formData) {
  const id = formData.get("id");
  const p = await prisma.advertiserProspect.findUnique({ where: { id } });
  if (!p || p.promotedLeadId) return;
  const lead = await prisma.lead.create({
    data: {
      company: p.company,
      website: p.website,
      stage: "prospect",
      product: p.suggestedProduct,
      notes: p.rationale ? `Prospect rationale: ${p.rationale}` : null,
    },
  });
  await prisma.advertiserProspect.update({
    where: { id },
    data: { promotedLeadId: lead.id },
  });
  revalidatePath("/advertisers");
  revalidatePath("/crm");
  revalidatePath("/");
}

// ---------- Content engine ----------

export async function shortlistFeedItem(formData) {
  const id = formData.get("id");
  const item = await prisma.feedItem.findUnique({ where: { id }, include: { brand: true } });
  if (!item || item.status === "shortlisted") return;
  await prisma.$transaction([
    prisma.feedItem.update({ where: { id }, data: { status: "shortlisted" } }),
    prisma.article.create({
      data: {
        title: item.title,
        type: "pr_rewrite",
        status: "idea",
        sourceItemId: item.id,
        sourceUrl: item.link,
      },
    }),
  ]);
  revalidatePath("/content");
}

export async function dismissFeedItem(formData) {
  await prisma.feedItem.update({
    where: { id: formData.get("id") },
    data: { status: "dismissed" },
  });
  revalidatePath("/content");
}

export async function addArticleIdea(formData) {
  const title = formData.get("title")?.trim();
  if (!title) return;
  await prisma.article.create({
    data: {
      title,
      type: "seo_original",
      status: "idea",
      keywords: formData.get("keywords")?.trim() || null,
    },
  });
  revalidatePath("/content");
}

const ARTICLE_FLOW = ["idea", "drafting", "review", "approved", "published"];

export async function advanceArticle(formData) {
  const id = formData.get("id");
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return;
  const next = ARTICLE_FLOW[ARTICLE_FLOW.indexOf(article.status) + 1];
  if (!next) return;
  await prisma.article.update({
    where: { id },
    data: { status: next, ...(next === "published" ? { publishedAt: new Date() } : {}) },
  });
  revalidatePath("/content");
}

export async function deleteArticle(formData) {
  const id = formData.get("id");
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return;
  await prisma.$transaction([
    ...(article.sourceItemId
      ? [
          prisma.feedItem.update({
            where: { id: article.sourceItemId },
            data: { status: "dismissed" },
          }),
        ]
      : []),
    prisma.article.delete({ where: { id } }),
  ]);
  revalidatePath("/content");
}

export async function saveArticle(formData) {
  const id = formData.get("id");
  const title = formData.get("title")?.trim();
  if (!title) return;
  await prisma.article.update({
    where: { id },
    data: { title, body: formData.get("body") || null, keywords: formData.get("keywords")?.trim() || null },
  });
  revalidatePath(`/content/article/${id}`);
  revalidatePath("/content");
}

export async function publishArticle(formData) {
  const id = formData.get("id");
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article || !article.body) return;
  const { isWordPressConfigured, publishToWordPress, uploadMedia, resolveCategory } =
    await import("./wordpress");
  const { stripEmDashes } = await import("./drafting");
  let wpPostId = article.wpPostId;
  if (isWordPressConfigured()) {
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
          const media = await uploadMedia({
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
    const post = await publishToWordPress({
      title: stripEmDashes(article.title),
      body,
      status: "publish",
      featuredMediaId,
      categoryId: await resolveCategory(article.category),
      keyphrase: article.keyphrase,
      metaDesc: article.metaDesc,
    });
    wpPostId = post.id;
  }
  await prisma.article.update({
    where: { id },
    data: { status: "published", publishedAt: new Date(), wpPostId },
  });
  revalidatePath(`/content/article/${id}`);
  revalidatePath("/content");
}

// ---------- SEO agent ----------

export async function approveSeoSuggestion(formData) {
  const id = formData.get("id");
  const suggestion = await prisma.seoSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.status !== "pending") return;
  try {
    const { applySuggestion } = await import("./seo-agent");
    await applySuggestion(suggestion);
    await prisma.seoSuggestion.update({
      where: { id },
      data: { status: "applied", appliedAt: new Date(), error: null },
    });
  } catch (e) {
    await prisma.seoSuggestion.update({
      where: { id },
      data: { status: "failed", error: e.message },
    });
  }
  revalidatePath("/seo");
}

export async function dismissSeoSuggestion(formData) {
  await prisma.seoSuggestion.update({
    where: { id: formData.get("id") },
    data: { status: "dismissed" },
  });
  revalidatePath("/seo");
}

export async function retrySeoSuggestion(formData) {
  await prisma.seoSuggestion.update({
    where: { id: formData.get("id") },
    data: { status: "pending", error: null },
  });
  revalidatePath("/seo");
}

// ---------- LinkedIn engine ----------

export async function addLinkedInPost(formData) {
  const text = formData.get("text")?.trim();
  if (!text) return;
  await prisma.linkedInPost.create({ data: { text } });
  revalidatePath("/linkedin");
}

// Approving is the human gate, and now the trigger too: an approved post gets a
// slot and the cron publishes it when that slot arrives. With LinkedIn not
// connected this behaves exactly as it always did, so the queue still works as
// a copy-and-paste list.
export async function advanceLinkedInPost(formData) {
  const id = formData.get("id");
  const post = await prisma.linkedInPost.findUnique({ where: { id } });
  if (!post) return;
  const next = post.status === "draft" ? "approved" : post.status === "approved" ? "posted" : null;
  if (!next) return;

  const data = { status: next };
  if (next === "approved") {
    const { getConnection, nextPostingSlot } = await import("./linkedin");
    const connection = await getConnection();
    if (connection && !connection.expired) {
      data.scheduledFor = await nextPostingSlot();
      data.publishError = null;
      data.attempts = 0;
    }
  } else {
    // "Mark posted" is the manual path: it records that you posted it by hand,
    // so the slot has to go with it or the cron would post it a second time.
    data.postedAt = new Date();
    data.scheduledFor = null;
  }

  await prisma.linkedInPost.update({ where: { id }, data });
  revalidatePath("/linkedin");
}

// Skip the slot and publish immediately.
export async function postLinkedInNow(formData) {
  const id = formData.get("id");
  const post = await prisma.linkedInPost.findUnique({ where: { id } });
  if (!post || post.status === "posted") return;

  const { publishPost } = await import("./linkedin");

  try {
    const result = await publishPost(post);
    await prisma.linkedInPost.update({
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
    await prisma.linkedInPost.update({ where: { id }, data: { publishError: e.message.slice(0, 500) } });
  }
  revalidatePath("/linkedin");
}

// Three failures park a post. This is the way back in once the cause is fixed.
export async function retryLinkedInPost(formData) {
  const { nextPostingSlot } = await import("./linkedin");
  await prisma.linkedInPost.update({
    where: { id: formData.get("id") },
    data: { attempts: 0, publishError: null, scheduledFor: await nextPostingSlot() },
  });
  revalidatePath("/linkedin");
}

export async function disconnectLinkedIn() {
  const { disconnect } = await import("./linkedin");
  await disconnect();
  revalidatePath("/linkedin");
}

export async function deleteLinkedInPost(formData) {
  await prisma.linkedInPost.delete({ where: { id: formData.get("id") } });
  revalidatePath("/linkedin");
}

// ---------- Backlink outreach ----------

// Edit before it goes. The queue is the only place an outreach email can be
// changed, and every field a human is likely to want to fix is editable here:
// the address the agent guessed, the subject, and the body itself.
export async function saveOutreachEmail(formData) {
  const id = formData.get("id");
  const row = await prisma.outreachEmail.findUnique({ where: { id } });
  if (!row || ["sent", "linked", "replied"].includes(row.status)) return;
  const contactEmail = formData.get("contactEmail")?.trim() || null;
  await prisma.outreachEmail.update({
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
    await prisma.prBrand.update({
      where: { id: row.brandId },
      data: {
        prContactEmail: contactEmail,
        contactConfidence: "confirmed",
        contactCheckedAt: new Date(),
      },
    });
  }
  revalidatePath("/outreach");
}

// The human gate, and the trigger. Approving sends it, because an email you
// have just read and approved should not then sit in a queue for an hour.
export async function approveOutreachEmail(formData) {
  const id = formData.get("id");
  const row = await prisma.outreachEmail.findUnique({ where: { id } });
  // "bounced" is approvable again: the fix for one is a new address, and then it
  // is the same email to the same brand about the same article.
  if (!row || !["pending", "approved", "failed", "bounced"].includes(row.status)) return;
  if (!row.contactEmail) {
    await prisma.outreachEmail.update({
      where: { id },
      data: { status: "failed", error: "No contact address. Add one and try again." },
    });
    revalidatePath("/outreach");
    return;
  }

  await prisma.outreachEmail.update({ where: { id }, data: { status: "approved", error: null } });
  try {
    const { sendOutreachEmail } = await import("./outreach");
    await sendOutreachEmail(id);
  } catch {
    // sendOutreachEmail has already written the reason to the row. Swallowing
    // the throw here keeps the queue on screen instead of an error page.
  }
  revalidatePath("/outreach");
}

// "I have checked it, that address is right."
//
// Needed because the send path refuses a guessed address, and typing the same
// address back into the box is not a change, so there would otherwise be no way
// to clear a guess that happens to be correct short of inventing a difference.
export async function confirmOutreachContact(formData) {
  const id = formData.get("id");
  const row = await prisma.outreachEmail.findUnique({ where: { id } });
  const email = formData.get("contactEmail")?.trim() || row?.contactEmail;
  if (!row?.brandId || !email) return;
  await prisma.outreachEmail.update({ where: { id }, data: { contactEmail: email } });
  await prisma.prBrand.update({
    where: { id: row.brandId },
    data: { prContactEmail: email, contactConfidence: "confirmed", contactCheckedAt: new Date() },
  });
  revalidatePath("/outreach");
}

export async function dismissOutreachEmail(formData) {
  await prisma.outreachEmail.update({
    where: { id: formData.get("id") },
    data: { status: "dismissed" },
  });
  revalidatePath("/outreach");
}

export async function retryOutreachEmail(formData) {
  await prisma.outreachEmail.update({
    where: { id: formData.get("id") },
    data: { status: "pending", error: null },
  });
  revalidatePath("/outreach");
}

// Someone replied asking to be left alone. This is the button for that, and it
// binds the brand, not the email: they never hear from the engine again.
export async function optOutBrand(formData) {
  const brandId = formData.get("brandId");
  if (!brandId) return;
  await prisma.prBrand.update({
    where: { id: brandId },
    data: { optedOut: true, optedOutAt: new Date() },
  });
  await prisma.outreachEmail.updateMany({
    where: { brandId, status: { in: ["pending", "approved", "failed"] } },
    data: { status: "dismissed" },
  });
  revalidatePath("/outreach");
}

// The link check only sees links on a brand's own news page. Coverage lands in
// plenty of places it cannot reach, so the result can be recorded by hand.
export async function markOutreachLinked(formData) {
  const id = formData.get("id");
  const url = formData.get("linkUrl")?.trim() || null;
  await prisma.outreachEmail.update({
    where: { id },
    data: { status: "linked", linkedAt: new Date(), linkUrl: url },
  });
  revalidatePath("/outreach");
}

export async function markOutreachReplied(formData) {
  await prisma.outreachEmail.update({
    where: { id: formData.get("id") },
    data: { status: "replied" },
  });
  revalidatePath("/outreach");
}

// Manual sweep, for when an article has just gone out and you do not want to
// wait for the six-hourly pass.
export async function scanForMentionsNow() {
  const { runBacklinkOutreach, isOutreachConfigured } = await import("./outreach");
  if (!isOutreachConfigured()) return;
  try {
    await runBacklinkOutreach();
  } catch {}
  revalidatePath("/outreach");
}

// ---------- Launch tracker ----------

// ---------- Costs ----------

export async function updateFixedCost(formData) {
  const key = formData.get("key");
  const monthlyUsd = Number(formData.get("monthlyUsd"));
  if (!key || !Number.isFinite(monthlyUsd) || monthlyUsd < 0) return;

  const { getFixedCosts, saveFixedCosts } = await import("./agents/costs");
  const items = await getFixedCosts();
  const next = items.map((i) =>
    // Once a figure is set by hand it is no longer awaiting confirmation.
    i.key === key ? { ...i, monthlyUsd, confirm: false } : i
  );
  await saveFixedCosts(next);
  revalidatePath("/engine-room/costs");
}

export async function updateCostTarget(formData) {
  const targetGbp = Number(formData.get("targetGbp"));
  if (!Number.isFinite(targetGbp) || targetGbp <= 0) return;
  const { saveSetting, TARGET_KEY } = await import("./agents/costs");
  await saveSetting(TARGET_KEY, targetGbp);
  revalidatePath("/engine-room/costs");
}

// ---------- Content suggestions ----------

// An idea from JB, dropped straight into the Researcher's queue. Kept as a
// ResearchTopic rather than an Article so it goes through the Director like any
// other topic, but flagged `source: "jb"` — the Director commissions these
// ahead of everything else and is not allowed to strike them out.
export async function suggestTopic(formData) {
  const title = formData.get("title")?.trim();
  if (!title) return;
  const brief = formData.get("brief")?.trim() || null;
  await prisma.researchTopic.create({
    data: {
      title: title.slice(0, 300),
      source: "jb",
      query: brief,
      rationale: "Requested by JB",
      score: 100,
      status: "proposed",
    },
  });
  revalidatePath("/engine-room");
}

export async function withdrawSuggestion(formData) {
  const id = formData.get("id");
  if (!id) return;
  // Scoped so this can only ever remove one of JB's own untouched suggestions,
  // never a topic the Researcher found or one already being written.
  await prisma.researchTopic.deleteMany({ where: { id, source: "jb", status: "proposed" } });
  revalidatePath("/engine-room");
}

// Hand the queue to the Director now rather than waiting for the next hourly
// tick. Manual wakes work outside operating hours by design.
export async function wakeDirectorNow() {
  const { ensureAgents } = await import("./agents/runtime");
  const { runDirector } = await import("./agents/team");
  await ensureAgents();
  try {
    await runDirector("manual");
  } catch {
    // The run records its own failure; the suggestion is already saved and will
    // be picked up on the next tick regardless.
  }
  revalidatePath("/engine-room");
}
