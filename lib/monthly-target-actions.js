"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";
import { METRIC_KEYS, RINGS_KEY, TARGET_PREFIX } from "./monthly-target-metrics";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const upsertSetting = (key, value) =>
  prisma.globalSetting.upsert({ where: { key }, create: { key, value }, update: { value } });

/**
 * Save one month's fleet targets from the home page editor.
 *
 * The form posts `t:<metric>` per box, `month`, and a `ring` checkbox per
 * measure. A blank box means no target for that measure, rather than a target
 * of zero.
 */
export async function saveMonthlyTargets(_prev, formData) {
  await requireEditor();
  const month = String(formData.get("month") || "");
  if (!MONTH.test(month)) return { ok: false, message: "That month isn't valid." };

  const values = {};
  for (const metric of METRIC_KEYS) {
    const text = String(formData.get(`t:${metric}`) ?? "").trim();
    if (text === "") continue;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, message: "Targets must be numbers of 0 or more." };
    }
    values[metric] = value;
  }

  const rings = formData.getAll("ring").map(String).filter((k) => METRIC_KEYS.includes(k));

  await prisma.$transaction([
    upsertSetting(`${TARGET_PREFIX}${month}`, JSON.stringify(values)),
    upsertSetting(RINGS_KEY, JSON.stringify(rings)),
  ]);

  revalidatePath("/");
  return { ok: true, message: "Targets saved." };
}
