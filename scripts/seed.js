// Seeds a user.
// Usage: node scripts/seed.js <username> <password> [display name] [role]
//
// role is "admin" (the default, full access) or "viewer" (read-only: signs in,
// reads every page, cannot write anything — see lib/permissions.js).
//
// It used to seed a sixteen-item launch checklist into LaunchItem as well. That
// table is now read by nothing: lib/milestones.js derives launch progress from
// what is actually true in the database instead, because the hand-ticked
// version reported 0 of 16 complete while the site was live and publishing
// daily. A checklist nobody updates is worse than no checklist — it is
// confidently wrong.
//
// The user is fleet-wide, so this script is not per-title. Titles are created
// by scripts/seed-smart-sme.js or from /new-title in the app.
const path = require("path");
process.loadEnvFile(path.join(__dirname, "..", ".env"));

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();


async function main() {
  const [username, password, name, role = "admin"] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: node scripts/seed.js <username> <password> [display name] [admin|viewer]");
    process.exit(1);
  }
  // Checked here rather than left to Postgres, because a typo'd role would
  // otherwise fail as an opaque enum error after the password had been hashed.
  if (role !== "admin" && role !== "viewer") {
    console.error(`Unknown role '${role}'. Use "admin" or "viewer".`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    // Re-running for an existing account resets the password AND the role, so
    // this script is also how you demote or restore someone.
    update: { passwordHash, role },
    create: { username, passwordHash, name: name || username, role },
  });
  console.log(`User '${username}' ready (${role}).`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
