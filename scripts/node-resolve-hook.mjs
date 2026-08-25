/**
 * Let plain Node run the app's lib/ modules.
 *
 * Next.js resolves extensionless relative imports (`from "./prisma"`); Node's
 * ESM loader does not, so a script that imports lib/prospects.js dies on its
 * first transitive import. Rather than rewrite the app's imports to suit the
 * scripts, this teaches Node the one resolution rule it is missing.
 *
 * Used as: node --import ./scripts/node-resolve-hook.mjs --env-file=.env <script>
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  new URL(
    "data:text/javascript," +
      encodeURIComponent(`
        import { existsSync } from "node:fs";
        import { fileURLToPath } from "node:url";

        export async function resolve(specifier, context, next) {
          try {
            return await next(specifier, context);
          } catch (err) {
            // Only extensionless relative specifiers are ours to fix; anything
            // else keeps Node's own error, which is the useful one.
            if (!specifier.startsWith(".") || /\\.[a-z]+$/i.test(specifier)) throw err;
            for (const ext of [".js", ".mjs", "/index.js"]) {
              const candidate = new URL(specifier + ext, context.parentURL);
              if (existsSync(fileURLToPath(candidate))) {
                return next(specifier + ext, context);
              }
            }
            throw err;
          }
        }
      `)
  ),
  pathToFileURL("./")
);
