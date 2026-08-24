import { auth } from "./auth";
import { prisma } from "./prisma";

// Who is allowed to change things.
//
// The app spent its first life with exactly one account, so "signed in" and
// "allowed to do anything" were the same statement and nothing needed to say
// so. proxy.js still enforces the first half — every route except the public
// ones requires a session — but it cannot enforce the second, because by the
// time a server action runs the proxy has long finished.
//
// So the check lives here and is called by the actions themselves. That is the
// only placement that actually holds: a server action is a POST endpoint with a
// generated id, reachable by anyone with a session and the id, whether or not
// the page rendered a button for it. Hiding the button is presentation. This is
// the boundary.

/** The signed-in user's role, or null when there is no session at all. */
export async function currentRole() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Read the role from the row, not from the JWT.
  //
  // The token is the wrong source twice over. A token minted before the role
  // column existed carries no role at all, so any pre-existing session — a
  // viewer's included — would have to be trusted or guessed at; guessing
  // "admin" is how a read-only account kept full rights after the column
  // shipped. And a role stored in a JWT is a snapshot: demoting someone would
  // not take effect until they next signed in, which is precisely when you
  // least want to wait.
  //
  // The cost is one indexed lookup on a table with two rows, on requests that
  // are already querying Postgres.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // No row means the account was deleted while signed in. No row, no rights.
  return user?.role ?? null;
}

/** True only for accounts that may write. Fails closed. */
export async function canEdit() {
  return (await currentRole()) === "admin";
}

/**
 * Thrown rather than returned, because every caller is a server action whose
 * return value is either ignored or rendered — a false that nobody checks would
 * read to the user as "saved" while nothing had been written. An exception
 * cannot be quietly dropped.
 */
export class ReadOnlyError extends Error {
  constructor() {
    super("This account is read-only. Sign in as an editor to make changes.");
    this.name = "ReadOnlyError";
  }
}

/**
 * Gate for every action that writes. Call it first, before reading the form or
 * touching the database, so a refused action has no side effects at all.
 */
export async function requireEditor() {
  if (await canEdit()) return;
  throw new ReadOnlyError();
}
