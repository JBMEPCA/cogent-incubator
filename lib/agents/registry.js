// The six specialists. Each owns one goal and is woken by events, never by a
// clock: continuous polling costs far more in idle tokens than the work itself.
export const AGENTS = {
  director: {
    key: "director",
    name: "Director",
    role: "Director",
    // Triage, not writing. 210 runs over a fortnight to say "team on track,
    // nothing to arbitrate" — and its prompt is 743 input tokens, below the
    // 1024-token minimum for a prompt cache, so the model rate is the only
    // lever it has. Sequencing work does not need the writing model.
    model: "claude-haiku-4-5",
    goal: "Hold the shape of the publication: keep the newsroom and the reference library in balance, and settle conflicts between agents.",
    // Deliberately last in the office layout: everything reports here.
    accent: "#2E3EEE",
    seat: { x: 50, y: 22 },
    triggers: ["tick", "conflict", "gate_failed"],
    blurb: "Sequences the team, rules on conflicts and stops two agents undoing each other's work.",
  },
  researcher: {
    key: "researcher",
    name: "Researcher",
    role: "Research",
    goal: "Find the topics and questions UK SME owners are actually searching for, before competitors cover them.",
    accent: "#0891b2",
    seat: { x: 18, y: 42 },
    triggers: ["tick", "feed_scanned", "gsc_refreshed"],
    blurb: "Mines Search Console, the newswire, autocomplete and People Also Ask for openings worth writing.",
  },
  seo: {
    key: "seo",
    name: "SEO Expert",
    role: "Search",
    // Linking comes first in this goal because it now comes first in the job:
    // every live article carries its internal links and links the brands it
    // names, and this agent is answerable for both. Everything else it does is
    // downstream of that.
    goal: "Make sure every live article carries its internal links and links the brands it names, then maximise search visibility without letting optimisation damage the writing.",
    accent: "#059669",
    seat: { x: 82, y: 42 },
    triggers: ["article_published", "link_sweep", "weekly_audit", "gsc_refreshed"],
    // Where this agent's work actually lands, shown as a button on its desk panel.
    link: { href: "/seo", label: "Open the SEO audit" },
    blurb: "Internal links and brand links first, then keyphrases, metadata and the audit sweep across everything already live.",
  },
  editor: {
    key: "editor",
    name: "Editor",
    role: "Editorial",
    goal: "Turn commissions into accurate, genuinely useful articles that a professional editor would sign off.",
    accent: "#8b5cf6",
    seat: { x: 30, y: 68 },
    triggers: ["topic_commissioned", "revision_requested"],
    link: { href: "/content", label: "Open the article pipeline" },
    blurb: "Writes and subedits, and refuses to publish anything that invents a statistic or a source.",
  },
  designer: {
    key: "designer",
    name: "Graphic Designer",
    role: "Imagery",
    goal: "Give every article a high-resolution image that genuinely matches it.",
    accent: "#d97706",
    seat: { x: 70, y: 68 },
    triggers: ["draft_ready", "low_res_found"],
    blurb: "Sources and visually verifies header images, and rejects anything off-topic or low resolution.",
  },
  finance: {
    key: "finance",
    name: "Finance Manager",
    role: "Cost",
    // Reads numbers and reports them. An agent that exists to reduce spend
    // should not be among the more expensive things running.
    model: "claude-haiku-4-5",
    goal: "Keep the cost per published article low and make every penny of spend visible.",
    accent: "#dc2626",
    seat: { x: 50, y: 88 },
    triggers: ["agent_run_finished", "daily_summary"],
    link: { href: "/engine-room/costs", label: "Open the cost breakdown" },
    blurb: "Tracks spend per agent and per article and advises the Director. Advisory only, never blocks.",
  },
  linkedin: {
    key: "linkedin",
    name: "LinkedIn Manager",
    role: "Social",
    goal: "Turn the site's best stories into consistent LinkedIn posts that sound like a person, not a feed.",
    accent: "#0a66c2",
    seat: { x: 50, y: 55 },
    triggers: ["article_published", "daily_queue"],
    link: { href: "/linkedin", label: "Open the post queue" },
    blurb: "Writes posts from the top-performing articles to a fixed house format, and queues them for approval.",
  },
  backlink: {
    key: "backlink",
    name: "Backlink Manager",
    role: "Outreach",
    goal: "Turn every brand we write about into a link back, and know exactly where each request stands.",
    accent: "#c026d3",
    seat: { x: 16, y: 88 },
    triggers: ["article_published", "daily_sweep"],
    link: { href: "/outreach", label: "Open the outreach queue" },
    blurb: "Finds the brands named in new articles, drafts the ask, then tracks replies and links won.",
  },
  newsletter: {
    key: "newsletter",
    name: "Newsletter Manager",
    role: "Email",
    goal: "Put the ten articles most worth a busy owner-manager's time into the weekly email, in the right order.",
    // Distinct from the Designer's amber, which it clashed with on the floor.
    accent: "#db2777",
    seat: { x: 84, y: 88 },
    triggers: ["weekly_issue"],
    link: { href: "/newsletter", label: "Open newsletter stats" },
    blurb: "Chooses and orders the week's ten stories. The template never changes, only the selection.",
  },
};

export const AGENT_LIST = Object.values(AGENTS);

// Per-million-token pricing, used to cost every call for real rather than
// estimating. Update when Anthropic pricing changes.
//
// Sonnet 5 is on introductory pricing ($2/$10) until 31 August 2026; the
// standard rate is used here so the figures never flatter themselves.
export const PRICING = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

// Cached input is not billed at the input rate, and treating it as though it
// were is how a caching change "saves" nothing on the dashboard. A cache READ
// is a tenth of the input price; a WRITE carries a premium — 1.25x at the
// default five-minute TTL, 2x at one hour.
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = { "5m": 1.25, "1h": 2 };

/**
 * Cost one call.
 *
 * Takes either plain token counts (costOf(model, in, out)) or the API's usage
 * object (costOf(model, usage)), which is the only form that can price cache
 * hits correctly. The two-number form is kept because the meter and several
 * older call sites use it, and it is right whenever nothing was cached.
 */
export function costOf(model, inputTokensOrUsage, outputTokens, cacheTtl = "1h") {
  const p = PRICING[model] || PRICING["claude-opus-4-8"];

  if (inputTokensOrUsage && typeof inputTokensOrUsage === "object") {
    const u = inputTokensOrUsage;
    const fresh = u.input_tokens || 0;
    const written = u.cache_creation_input_tokens || 0;
    const read = u.cache_read_input_tokens || 0;
    const out = u.output_tokens || 0;
    const writeMultiplier = CACHE_WRITE_MULTIPLIER[cacheTtl] ?? CACHE_WRITE_MULTIPLIER["5m"];
    return (
      (fresh / 1e6) * p.in +
      (written / 1e6) * p.in * writeMultiplier +
      (read / 1e6) * p.in * CACHE_READ_MULTIPLIER +
      (out / 1e6) * p.out
    );
  }

  return (inputTokensOrUsage / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}
