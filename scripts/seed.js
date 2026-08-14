// Seeds the single director user and the launch-phase checklist.
// Usage: node scripts/seed.js <username> <password> [display name]
const path = require("path");
process.loadEnvFile(path.join(__dirname, "..", ".env"));

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const LAUNCH_ITEMS = [
  ["brand", "Buy domain"],
  ["brand", "Site build / CMS setup"],
  ["brand", "Masthead & logo finalised"],
  ["brand", "Editorial style guide"],
  ["content", "Daily news coverage live"],
  ["content", "50-article backlog built"],
  ["content", "SEO keyword mapping"],
  ["audience", "Data import"],
  ["audience", "Newsletter sign-ups open"],
  ["audience", "LinkedIn content strategy running"],
  ["audience", "SEO traction (first ranking pages)"],
  ["monetise", "Rate card confirmed"],
  ["monetise", "Advertiser prospect list built"],
  ["monetise", "First 6–8 banner clients signed"],
  ["monetise", "First solus e-shot sold"],
  ["monetise", "First web story sold"],
];

async function main() {
  const [username, password, name] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: node scripts/seed.js <username> <password> [display name]");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash, name: name || username },
  });
  console.log(`User '${username}' ready.`);

  const existing = await prisma.launchItem.count();
  if (existing === 0) {
    await prisma.launchItem.createMany({
      data: LAUNCH_ITEMS.map(([phase, title], i) => ({ phase, title, sortOrder: i })),
    });
    console.log(`Seeded ${LAUNCH_ITEMS.length} launch checklist items.`);
  } else {
    console.log("Launch checklist already seeded — skipped.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
