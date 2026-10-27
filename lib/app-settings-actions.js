"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";
import { automationSpec } from "./automations";
import { runSharedChecks, TITLE_KINDS } from "./connections";
import { listSites, siteCredentials, recordCredentialHealth } from "./site";
import { probeCredential } from "./probe";

// App settings → Automations and Connections. Admins only, like everything that
// writes. Each automation value is checked against its own option list, so the
// form can only ever store something the reading module understands.

const AUTOMATIONS_PATH = "/settings/automations";
const CONNECTIONS_PATH = "/settings/connections";

/** Returns { ok, message }. */
export async function setAutomation(_prev, fd) {
  await requireEditor();
  const key = fd.get("key")?.toString() || "";
  const value = fd.get("value")?.toString() || "";
  const spec = automationSpec(key);
  if (!spec) return { ok: false, message: "Unknown setting." };
  const option = spec.options.find((o) => o.value === value);
  if (!option) return { ok: false, message: "Pick one of the options." };

  await prisma.globalSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  revalidatePath(AUTOMATIONS_PATH);
  return { ok: true, message: `${spec.label}: ${option.label}.` };
}

/** Run every shared-service check now. Returns { ok, message }. */
export async function checkConnectionsNow() {
  await requireEditor();
  const { results } = await runSharedChecks();
  const bad = Object.values(results).filter((r) => !r.ok).length;
  revalidatePath(CONNECTIONS_PATH);
  return { ok: bad === 0, message: bad ? `${bad} need attention.` : "Everything answered." };
}

/**
 * Re-probe every title's saved credentials, with the same probe and the same
 * stored result as each title's own Settings page.
 */
export async function recheckTitles() {
  await requireEditor();
  const sites = await listSites();
  let checked = 0;
  let skipped = 0;
  // One title at a time, its kinds in sequence. All ten at once is the kind of
  // burst that trips SiteGround's bot check (they share a host), and a tripped
  // check used to read as a failure on every title.
  for (const site of sites) {
    const { creds } = await siteCredentials(site.id).catch(() => ({ creds: {} }));
    for (const { kind } of TITLE_KINDS) {
      if (!creds[kind]) continue;
      const result = await probeCredential(kind, creds[kind]);
      // An answer that says nothing about the credentials is not stored: the
      // last real result stays rather than being overwritten with a red dot.
      if (result.inconclusive) {
        skipped++;
        continue;
      }
      await recordCredentialHealth(site.id, kind, {
        healthy: result.ok,
        error: result.ok ? result.warning : result.error,
      });
      checked++;
    }
  }
  revalidatePath(CONNECTIONS_PATH);
  return {
    ok: skipped === 0,
    message:
      `Rechecked ${checked} connections across ${sites.length} titles.` +
      (skipped ? ` ${skipped} couldn't be checked, so their last result was kept.` : ""),
  };
}
