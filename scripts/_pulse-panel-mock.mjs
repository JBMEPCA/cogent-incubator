/**
 * Render PulsePanel on its own, with LIVE data pulled from the ten sites.
 *
 * Written because the last change to this page shipped with a variable that was
 * never declared, and both checks I ran (counting table cells, calling the
 * endpoints) passed without ever rendering anything. This renders it.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_pulse-panel-mock.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const WT = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/ab747c79-736f-42fc-8062-1a21d89ca420/scratchpad/pulse-wt";
const OUT = path.resolve("node_modules/.cache/pulse-panel");
fs.mkdirSync(OUT, { recursive: true });

// Real numbers from the real sites, so the panel is tested against what it
// will actually be handed rather than tidy invented figures.
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const token = (process.env.PULSE_TOKEN || "").trim();
const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  orderBy: { slug: "asc" },
});

const pulse = { days: 28, bySite: {}, totals: { humans: 0, bots: 0 }, errors: [], counting: 0, first: null };
const rows = [];
await Promise.all(
  sites.map(async (site) => {
    rows.push({ id: site.id, name: site.name, accentHex: site.accentHex });
    const { creds } = await siteCredentials(site.id);
    const base = creds?.wordpress?.url;
    if (!base) return;
    try {
      const r = await fetch(
        `${base.replace(/\/$/, "")}/wp-json/cogent/v1/pulse/report?days=28&token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(9000) }
      );
      if (!r.ok) return;
      const j = await r.json();
      pulse.bySite[site.id] = { humans: j.humans, bots: j.bots, sources: j.sources, first: j.first };
      pulse.totals.humans += j.humans;
      pulse.totals.bots += j.bots;
      pulse.counting++;
      if (j.first && (!pulse.first || j.first < pulse.first)) pulse.first = j.first;
    } catch {}
  })
);
await prisma.$disconnect();
console.log(`live data: ${pulse.counting} titles reporting, ${pulse.totals.humans} readers, since ${pulse.first}`);

const entry = path.join(OUT, "entry.jsx");
fs.writeFileSync(
  entry,
  `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PulsePanel from ${JSON.stringify(path.join(WT, "app/analytics/PulsePanel.jsx"))};
globalThis.__HTML = renderToStaticMarkup(
  <PulsePanel pulse={${JSON.stringify(pulse)}} rows={${JSON.stringify(rows)}} />
);
// The empty case matters more than the full one right now.
globalThis.__EMPTY = renderToStaticMarkup(
  <PulsePanel pulse={{ days: 28, bySite: {}, totals: { humans: 0, bots: 0 }, errors: [], counting: 10, first: null }} rows={${JSON.stringify(rows)}} />
);
`
);

const bundle = path.join(OUT, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundle,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  loader: { ".jsx": "jsx" },
  external: ["react", "react-dom"],
  logLevel: "error",
});
await import(`file://${bundle.replace(/\\/g, "/")}`);

const css = fs.readFileSync(path.join(WT, "app/globals.css"), "utf8");
const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse panel</title>
<style>${css}</style>
<style>body{padding:24px;background:var(--bg,#0b1020)}.w{max-width:1100px;margin:0 auto}
h4{font:600 11px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8b97c6;margin:22px 0 8px}</style>
</head><body><div class="w">
<h4>with the live numbers</h4>
${globalThis.__HTML}
<h4>with nothing counted yet</h4>
${globalThis.__EMPTY}
</div></body></html>`;

const file = path.join(OUT, "panel.html");
fs.writeFileSync(file, html);
console.log(file);
