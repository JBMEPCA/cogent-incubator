import { cronGuard } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * Which commit is actually serving.
 *
 * The playbook's pre-flight has said "pushed is not deployed" since title #3,
 * and the only way to check was `vercel ls` on a machine with the CLI logged
 * in. That is too much friction for a check that matters every time a cron's
 * behaviour depends on code that landed minutes ago — a push whose build hook
 * did not fire leaves the fleet running yesterday's logic while git says the
 * fix shipped.
 *
 * Guarded rather than public: the commit SHA and branch are not secret, but
 * they are not anyone else's business either.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  return Response.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    shortCommit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    env: process.env.VERCEL_ENV ?? "development",
    deploymentUrl: process.env.VERCEL_URL ?? null,
  });
}
