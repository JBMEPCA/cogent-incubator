// Print the best contact address for a list of domains.
//
// A thin command line over scripts/lib/find-address.mjs, which is where the
// logic lives now that the harvesters need it too. Useful on its own for
// checking a handful of companies by hand before writing to them.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/find-press-contact.mjs \
//     domain1.com domain2.co.uk ...
//   node --import ./scripts/node-resolve-hook.mjs scripts/find-press-contact.mjs --file=list.txt

import { readFileSync } from "node:fs";
import { findAddress } from "./lib/find-address.mjs";

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const domains = fileArg
  ? readFileSync(fileArg.split("=")[1], "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : args.filter((a) => !a.startsWith("--"));

if (!domains.length) {
  console.log("Usage: find-press-contact.mjs <domain> [domain...] | --file=list.txt");
  process.exit(1);
}

let found = 0;
for (const domain of domains) {
  let got = null;
  try {
    got = await findAddress(domain);
  } catch {}
  if (got) found++;
  console.log(`${domain.padEnd(34)} ${got ? `${got.email}   [${got.source}]` : "none published"}`);
  const others = (got?.all || []).filter((a) => a !== got.email).slice(0, 3);
  if (others.length) console.log(`${" ".repeat(34)} also: ${others.join("  ")}`);
}

console.log(`\n${domains.length} domains, ${found} with an address.`);
