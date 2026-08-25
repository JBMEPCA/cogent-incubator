# Cogent Incubator

Multi-title fleet app — the rebuild that lets one codebase run several magazine
titles. Forked from `smart-sme-app`, which is why `package.json` still says
`"name": "smart-sme-app"`.

Session prefix: `🚀 COGENT`

## Stack

Next.js (App Router) · Prisma · NextAuth · `@anthropic-ai/sdk` · deployed on Vercel.

```bash
npm run dev
```

Use the browser preview tools rather than running this in a shell — `.claude/launch.json`
already defines the `cogent-incubator` config on port 3000.

## Per-title secrets

Each title's credentials are encrypted in the database, not held in environment
variables. Adding a title means seeding its secrets, not editing `.env`.

## Vercel

Environment variable changes do not take effect until a redeploy. Changing a value in
the Vercel dashboard alone will leave the running deployment on the old value.

## Untracked local files

`.env`, `.env.local`, `service-account.json` are git-ignored and hold live credentials.
Never print their contents or commit them.

## New titles

Follow `docs/new-title-playbook.md` and add to it after every launch — that document is
what gets each new title live faster than the last.
