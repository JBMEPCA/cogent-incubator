// Shared token meter.
//
// Agents delegate real work to lib/drafting, lib/images and lib/qa, which build
// their own Anthropic clients. Without this those calls are invisible to the
// Finance Manager, so the Designer and Editor report $0 for work that actually
// costs more than anything else in the system. Those libs report usage here and
// the agent runtime drains it into the run record.
//
// A module-level buffer is safe here: this is a single-user app and each agent
// turn runs in its own serverless invocation.
import { costOf } from "./registry";

let buffer = null;

export function startMetering() {
  buffer = { input: 0, output: 0, cost: 0, calls: 0, model: null };
}

/** Called by any lib that talks to the API. No-op outside an agent turn. */
export function recordUsage(model, usage) {
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
  buffer.cached = (buffer.cached || 0) + (usage.cache_read_input_tokens || 0);
  buffer.calls += 1;
  buffer.model = model;
}

export function drainMetering() {
  const out = buffer || { input: 0, output: 0, cost: 0, calls: 0, model: null };
  buffer = null;
  return out;
}
