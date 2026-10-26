"use server";

// Kept out of lib/actions.js so the analytics page does not pull the whole
// drafting engine into its bundle for one Refresh button.
import { revalidatePath } from "next/cache";
import { requireEditor } from "./permissions";
import { refreshLinkedInStats } from "./linkedin-stats";

export async function refreshLinkedInStatsNow() {
  await requireEditor();
  await refreshLinkedInStats();
  revalidatePath("/analytics");
}
