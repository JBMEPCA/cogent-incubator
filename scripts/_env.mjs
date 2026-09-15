// The .env loading that every script needs and each one was pasting.
//
// Next reads .env for the app; bare `node` does not, so a script importing
// lib/ gets a Prisma client with no DATABASE_URL and a Mailchimp call with no
// key. Import this FIRST — ESM evaluates in import order, so the variables are
// in place before lib/prisma.js constructs its client.
//
// Real environment wins over the file, so a one-off override on the command
// line still works.
import fs from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
