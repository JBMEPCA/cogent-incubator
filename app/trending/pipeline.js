"use client";

import { publishTrendNow, resumeTrend } from "@/lib/trending-actions";

// The whole route from commissioned to live, run from the browser so nothing
// waits on the half-hourly engine tick: write it (a QA hold is repaired in the
// same Editor run), picture it, publish it. Each step is its own request with
// its own time budget. If the tab closes part way, the server finishes the step
// it is on and the queue rules take the rest on the next tick.
//
// `skip` lets the Push live button resume a piece part way through: waking the
// Editor when the article is already written would draft a different one.

async function wake(agent, slug, articleId) {
  const article = articleId ? `&article=${encodeURIComponent(articleId)}` : "";
  const res = await fetch(`/api/agents/wake?agent=${agent}&site=${encodeURIComponent(slug)}${article}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.text()).slice(0, 160) || `${agent} returned ${res.status}`);
  return res.json();
}

export async function runTrendPipeline({ topicId, siteSlug, siteName, skipDraft = false, skipPicture = false }, onStep) {
  const notes = [];
  if (!skipDraft) {
    const articleId = await resumeTrend(topicId);
    onStep(`Writing for ${siteName || "the title"}…`);
    const drafted = await wake("editor", siteSlug, articleId);
    if (drafted?.summary) notes.push(drafted.summary);
  }
  if (!skipPicture) {
    onStep("Finding a picture…");
    const pictured = await wake("designer", siteSlug);
    if (pictured?.summary) notes.push(pictured.summary);
  }
  onStep("Publishing…");
  const pub = await publishTrendNow(topicId);
  return { published: Boolean(pub?.published), note: pub?.published ? "Live now." : pub?.error, notes };
}
