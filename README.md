# Smart SME — Launch HQ

Private single-user dashboard for launching Smart SME (the UK's publication for smart SMEs): to-dos, launch-phase tracker, CRM and content automations.

## Stack

Next.js 16 (App Router, `proxy.js` middleware) · React 19 · Prisma 5 + Neon Postgres · NextAuth v5 (single credentials login).

## Setup

1. Create a Neon Postgres project and paste its connection string into `.env` as `DATABASE_URL`.
2. `npx prisma migrate dev --name init`
3. `npm run seed -- <username> <password> "Your Name"`
4. `npm run dev`

## Backlink outreach

`/outreach` finds the brands named in each published article and drafts them an
email saying so, with a paste-ready paragraph for their news page and a LinkedIn
post already written. Nothing is sent without approval on that page, and an
opt-out is permanent.

Env:

| Variable | Purpose |
| --- | --- |
| `OUTREACH_FROM_EMAIL` | Mailbox the outreach is sent from, e.g. `jb@smartsme.co.uk`. Sending is disabled until this is set; the queue still works as copy-and-paste. |
| `OUTREACH_FROM_NAME` | Display name on the From header. Defaults to James Burke. |
| `OUTREACH_REPLY_TO` | Optional, if replies should land somewhere else. |
| `OUTREACH_POSTAL_ADDRESS` | Shown in the footer. UK B2B outreach needs a real identifiable sender. |
| `APP_URL` | Already used elsewhere; the one-click unsubscribe link is built from it. |

**Gmail sending needs two manual steps in two different Google consoles**, like
WordPress settings are a wp-admin job. Both are required and each fails with its
own 403.

First, in **Google Cloud console** → APIs and services → Library, enable the
**Gmail API** on the project that owns the service account. Delegation can be
perfectly configured and sending still fails without this.

Second, a service account cannot own a mailbox, so it has to impersonate the
sender. In **Google Admin** → Security → Access and data control → API controls
→ Domain-wide delegation, add the service account's **client ID** (the numeric
`client_id` in the key JSON, not the email) with scope:

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
```

Until that exists, `lib/google.js` returns `unauthorized_client` and says so.

`gmail.readonly` is what lets the Backlink Manager see replies. Without it the
agent reports "cannot see the inbox" rather than a misleading zero, and replies
have to be ticked off by hand on `/outreach`. Add both scopes in one go: editing
a delegation entry later means re-entering the whole scope list.

### The Backlink Manager

`lib/agents/backlink.js` owns the loop end to end: it reads new articles for
brand mentions, drafts the ask, watches for replies and watches brand sites for
the link, then reports to the Director by name rather than by count. It never
sends. `/api/cron/backlink-outreach` puts approved mail on the wire and does
nothing else, so approval stays a human job and sending keeps working outside
office hours.
