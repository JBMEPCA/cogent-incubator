// Lets a plain `node` script import the app's lib/ modules.
//
// Next resolves extensionless relative imports and the "@/" alias; bare Node
// does not, so `import { fleetAnalytics } from "../lib/fleet-analytics.js"`
// dies on the first `import ... from "./prisma"` inside it. Rather than
// littering every lib file with .js extensions to suit a check script, this
// teaches the loader the two rules Next already applies.
//
// Only ever loaded by scripts/ — nothing in the app imports it.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_SHIM = pathToFileURL(resolvePath(ROOT, "scripts/_next-cache-shim.mjs")).href;

export async function resolve(specifier, context, next) {
  // next/cache only works inside a Next server. The shim runs the function
  // uncached, which is what a verification script wants anyway: it should read
  // live numbers, not whatever a cache happened to be holding.
  if (specifier === "next/cache") return { url: CACHE_SHIM, shortCircuit: true };

  const mapped = specifier.startsWith("@/")
    ? pathToFileURL(resolvePath(ROOT, specifier.slice(2))).href
    : specifier;

  try {
    return await next(mapped, context);
  } catch (err) {
    // Extensionless relative or aliased import — try the file Next would pick.
    if (err?.code === "ERR_MODULE_NOT_FOUND" && !mapped.endsWith(".js")) {
      for (const ext of [".js", ".mjs", "/index.js"]) {
        try {
          return await next(mapped + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}
