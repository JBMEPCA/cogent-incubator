// Shared token meter.
//
// Agents delegate real work to lib/drafting, lib/images, lib/qa, lib/seo-agent
// and lib/outreach, which build their own Anthropic clients. Without this those
// calls are invisible to the Finance Manager, so the Designer and Editor would
// report $0 for the most expensive work in the system. Those libs report usage
// here and the agent runtime folds it into the run record.
//
// This used to be a single module-level buffer, justified by a comment saying
// each agent turn runs in its own serverless invocation. That stopped being
// true twice over: lib/cron.js runs every title in ONE invocation, and Fluid
// compute lets one warm instance serve the director and worker stages
// concurrently. Either way the second turn's startMetering() wiped the first's
// buffer and the cost landed on the wrong agent — or on nobody, which is why
// completed Editor runs were recorded at $0 having just written 6,000 tokens.
//
// AsyncLocalStorage scopes the buffer to the turn instead. Concurrent turns on
// one instance each see their own, and a lib called outside a turn is a no-op
// exactly as before.
import { AsyncLocalStorage } from "node:async_hooks";
import { costOf } from "./registry";

const storage = new AsyncLocalStorage();

/** A fresh buffer. The caller keeps it, so it is still readable if the turn throws. */
export function meteringBuffer() {
  return { input: 0, output: 0, cost: 0, calls: 0, cached: 0, model: null };
}

/** Run `fn` with `buffer` as the active meter for everything it awaits. */
export function runMetered(buffer, fn) {
  return storage.run(buffer, fn);
}

/** Called by any lib that talks to the API. No-op outside an agent turn. */
export function recordUsage(model, usage) {
  const buffer = storage.getStore();
  if (!buffer || !usage) return;
  const input =
    (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const output = usage.output_tokens || 0;
  buffer.input += input;
  buffer.output += output;
  // The token counters stay as totals — they answer "how much context did this
  // move" — but cost is taken from the usage object so cache reads are priced
  // at a tenth rather than at full input rate.
  buffer.cost += costOf(model, usage);
  buffer.cached += usage.cache_read_input_tokens || 0;
  buffer.calls += 1;
  buffer.model = model;
}
