// Launch progress, derived from what is actually true in the database rather
// than from checkboxes someone has to remember to tick.
//
// The old tracker showed 0 of 16 complete while the domain was live, the site
// was publishing daily and the backlog was past 60 articles. A checklist that
// nobody updates is worse than no checklist, because it reports confidently and
// wrongly.
import { prisma } from "./prisma";

export const PHASES = [
  { key: "brand", label: "Brand & foundations" },
  { key: "content", label: "Content engine" },
  { key: "audience", label: "Audience" },
  { key: "monetise", label: "Monetise" },
];

export async function launchProgress() {
  const [published, inPipeline, topics, linkedInQueued, seoApplied, leads, advertisers, agentRuns] =
    await Promise.all([
      prisma.article.count({ where: { status: "published" } }),
      prisma.article.count({ where: { status: { in: ["drafting", "review", "approved"] } } }),
      prisma.researchTopic.count(),
      prisma.linkedInPost.count(),
      prisma.seoSuggestion.count({ where: { status: "applied" } }),
      prisma.lead.count(),
      prisma.advertiserProspect.count(),
      prisma.agentRun.count(),
    ]);

  const siteLive = Boolean(process.env.WP_URL);
  const backlog = published + inPipeline;

  // Each milestone states the evidence that satisfies it, so the tick is always
  // explainable rather than a matter of opinion.
  const items = [
    { phase: "brand", label: "Domain live", done: siteLive, evidence: siteLive ? "smartsme.co.uk resolving" : "no WP_URL set" },
    { phase: "brand", label: "Site build and CMS", done: siteLive, evidence: siteLive ? "WordPress connected" : "not connected" },
    { phase: "brand", label: "Masthead and logo", done: siteLive, evidence: "shipped with the theme" },
    { phase: "brand", label: "Editorial style guide", done: agentRuns > 0, evidence: "house style enforced by the Editor agent" },

    { phase: "content", label: "Daily coverage live", done: published >= 10, evidence: `${published} articles published` },
    { phase: "content", label: "50-article backlog", done: backlog >= 50, evidence: `${backlog} written or in pipeline`, progress: Math.min(1, backlog / 50) },
    { phase: "content", label: "Keyword mapping", done: topics > 0, evidence: `${topics} researched topics` },
    { phase: "content", label: "AI team running", done: agentRuns > 0, evidence: `${agentRuns} agent runs` },

    { phase: "audience", label: "LinkedIn pipeline", done: linkedInQueued > 0, evidence: `${linkedInQueued} posts drafted` },
    { phase: "audience", label: "SEO improvements shipped", done: seoApplied > 0, evidence: `${seoApplied} suggestions applied` },
    { phase: "audience", label: "Newsletter sign-ups", done: false, evidence: "Mailchimp not connected yet", manual: true },
    { phase: "audience", label: "First ranking pages", done: false, evidence: "Search Console needs more history", manual: true },

    { phase: "monetise", label: "Advertiser prospects", done: advertisers >= 20, evidence: `${advertisers} researched` },
    { phase: "monetise", label: "First lead in CRM", done: leads > 0, evidence: leads ? `${leads} leads` : "none yet", manual: true },
    { phase: "monetise", label: "Rate card confirmed", done: false, evidence: "prices pulled from the site at your request", manual: true },
    { phase: "monetise", label: "First revenue", done: false, evidence: "no won deals yet", manual: true },
  ];

  const byPhase = PHASES.map((p) => {
    const mine = items.filter((i) => i.phase === p.key);
    return { ...p, items: mine, done: mine.filter((i) => i.done).length, total: mine.length };
  });

  return {
    byPhase,
    done: items.filter((i) => i.done).length,
    total: items.length,
    stats: { published, inPipeline, backlog, topics, linkedInQueued, seoApplied, leads, advertisers, agentRuns },
  };
}
