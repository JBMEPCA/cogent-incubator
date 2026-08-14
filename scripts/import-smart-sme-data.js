/**
 * Copy Smart SME's live content into the hub as title #1.
 *
 *   node scripts/import-smart-sme-data.js --from "<old DATABASE_URL>" [--commit]
 *
 * READ-ONLY against the source. It opens the old database, reads, and writes
 * into the new one. It never issues a single write to the source, so the
 * original app keeps running throughout and this can be re-run as many times as
 * needed until the result looks right.
 *
 * Dry run by default. Nothing is written without --commit.
 *
 * Idempotent: every row keeps its original id, so a second run updates rather
 * than duplicating. That matters because the realistic way this gets used is
 * "run it, look at the app, notice something missing, run it again".
 *
 * Order matters — PrBrand before FeedItem before Article before OutreachEmail —
 * because the foreign keys point that way and a child inserted before its
 * parent is rejected.
 */

const { PrismaClient } = require("@prisma/client");
const path = require("path");
process.loadEnvFile(path.join(__dirname, "..", ".env"));

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const fromIdx = args.indexOf("--from");
const FROM = fromIdx > -1 ? args[fromIdx + 1] : process.env.SOURCE_DATABASE_URL;
const SLUG = "smart-sme";

if (!FROM) {
  console.error("Usage: node scripts/import-smart-sme-data.js --from \"<old DATABASE_URL>\" [--commit]");
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: FROM } } });
const target = new PrismaClient();

// Tables in dependency order, with the fields that exist on both schemas. The
// new columns (siteId) are added per row; everything else copies across as-is.
// [prisma model, physical table] — the source must be read with raw SQL, not
// through this project's client. The generated client expects a siteId column
// on every one of these, the old database has no such column, and Prisma builds
// an explicit column list, so every read fails with "column does not exist".
// SELECT * takes whatever the old schema actually has.
const TABLES = [
  "prBrand",
  "feedItem",
  "article",
  "outreachEmail",
  "seoSuggestion",
  "linkedInPost",
  "researchTopic",
  "advertiserProspect",
  "lead",
  "todo",
  "newsletterProspect",
  "agentRun",
  "agentMessage",
];

const BATCH = 500;

async function main() {
  const site = await target.site.findUnique({ where: { slug: SLUG } });
  if (!site) {
    console.error(`No site with slug "${SLUG}". Run scripts/seed-smart-sme.js first.`);
    process.exit(1);
  }

  console.log(COMMIT ? "COMMIT — writing to the hub\n" : "DRY RUN — nothing will be written. Add --commit when it looks right.\n");
  console.log(`target site: ${site.name} (${site.id})\n`);

  const summary = [];

  for (const table of TABLES) {
    const physical = table[0].toUpperCase() + table.slice(1);
    let rows;
    try {
      rows = await source.$queryRawUnsafe(`SELECT * FROM "${physical}"`);
    } catch (e) {
      summary.push([table, 0, `source read failed: ${String(e.message).slice(0, 50)}`]);
      continue;
    }

    if (!rows.length) {
      summary.push([table, 0, "empty in source"]);
      continue;
    }

    if (!COMMIT) {
      summary.push([table, rows.length, "would copy"]);
      continue;
    }

    let written = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      for (const row of slice) {
        // agentRun's composite relation needs the site on both halves.
        // BigInt survives raw SQL as a bigint; Prisma wants a Number for Int
        // columns, and JSON.stringify on one throws outright.
        const clean = {};
        for (const [k, v] of Object.entries(row)) {
          clean[k] = typeof v === "bigint" ? Number(v) : v;
        }
        const data = { ...clean, siteId: site.id };
        try {
          await target[table].upsert({
            where: { id: row.id },
            create: data,
            update: data,
          });
          written++;
        } catch (e) {
          // A row that will not land is reported rather than aborting the table.
          // Usually a foreign key to something the source had and the target
          // does not — worth seeing, not worth losing the other 3,000 rows over.
          skipped++;
          // Prisma validation messages open with a blank line, so taking the
          // first one reported every failure as empty and hid the real cause.
          if (skipped <= 2) {
            console.log(`\n    ! ${table} ${row.id}: ${String(e.message).replace(/\s+/g, " ").trim().slice(0, 160)}`);
          }
        }
      }
      process.stdout.write(`\r  ${table}: ${written}/${rows.length}   `);
    }
    process.stdout.write("\r");
    summary.push([table, written, skipped ? `${skipped} skipped` : "ok"]);
  }

  console.log("\n" + "table".padEnd(22) + "rows".padStart(8) + "   note");
  console.log("-".repeat(60));
  for (const [t, n, note] of summary) {
    console.log(t.padEnd(22) + String(n).padStart(8) + "   " + note);
  }
  const total = summary.reduce((s, [, n]) => s + n, 0);
  console.log("-".repeat(60));
  console.log("total".padEnd(22) + String(total).padStart(8));

  if (!COMMIT) console.log("\nDry run only. Re-run with --commit to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
