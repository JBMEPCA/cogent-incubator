"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";
import { METRIC_KEYS, RINGS_KEY } from "./monthly-targets";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Save one month's targets from the home page editor.
 *
 * The form posts `t:<siteId>:<metric>` per box, `month`, and a `ring` checkbox
 * per measure. A blank box deletes that target rather than storing a zero, so
 * "no target" and "aim for nothing" stay different things. The whole month is
 * written in one transaction: half a save would leave the fleet total meaning
 * nothing.
 */
export async function saveMonthlyTargets(_prev, formData) {
  await requireEditor();
  const month = String(formData.get("month") || "");
  if (!MONTH.test(month)) return { ok: false, message: "That month isn't valid." };

  const siteIds = new Set(
    (await prisma.site.findMany({ select: { id: true } })).map((s) => s.id)
  );

  const upserts = [];
  const deletes = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("t:")) continue;
    const [, siteId, metric] = name.split(":");
    if (!siteIds.has(siteId) || !METRIC_KEYS.includes(metric)) continue;
    const text = String(raw).trim();
    if (text === "") {
      deletes.push({ siteId, month, metric });
      continue;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, message: "Targets must be numbers of 0 or more." };
    }
    upserts.push(
      prisma.monthlyTarget.upsert({
        where: { siteId_month_metric: { siteId, month, metric } },
        create: { siteId, month, metric, value },
        update: { value },
      })
    );
  }

  const rings = formData.getAll("ring").map(String).filter((k) => METRIC_KEYS.includes(k));

  await prisma.$transaction([
    ...upserts,
    ...deletes.map((where) => prisma.monthlyTarget.deleteMany({ where })),
    prisma.globalSetting.upsert({
      where: { key: RINGS_KEY },
      create: { key: RINGS_KEY, value: JSON.stringify(rings) },
      update: { value: JSON.stringify(rings) },
    }),
  ]);

  revalidatePath("/");
  return { ok: true, message: "Targets saved." };
}
