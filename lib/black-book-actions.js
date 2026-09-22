"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";

// The Black Book: advertising contacts kept for later (see BlackBookContact in
// the schema). Fleet-wide, so these actions take no bound site; the titles a
// contact matters to come from the form's checkboxes and are checked against
// the Site table rather than trusted.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const today = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

/**
 * useActionState-shaped: returns { ok, message } so the form can say what
 * happened. A repeat email merges into the existing record, and the message
 * says so, because "saved" alone would hide that nothing new was created.
 */
export async function saveBlackBookContact(_prev, formData) {
  await requireEditor();

  const text = (k) => formData.get(k)?.toString().trim() || "";
  const company = text("company");
  const name = text("name") || null;
  const email = text("email").toLowerCase();
  const notes = text("notes") || null;
  const followUp = text("followUpDate");

  if (!company) return { ok: false, message: "Company is required." };
  if (!EMAIL.test(email)) return { ok: false, message: "That email address doesn't look right." };

  // "All titles" is stored as an empty list, so a later title launch is
  // included without anyone editing old records.
  const all = formData.get("allTitles") === "on";
  const picked = formData.getAll("siteIds").map(String);
  const known = picked.length
    ? (await prisma.site.findMany({ where: { id: { in: picked } }, select: { id: true } })).map((s) => s.id)
    : [];
  if (!all && known.length === 0) return { ok: false, message: "Pick at least one title, or All titles." };
  const siteIds = all ? [] : known;
  const followUpDate = followUp ? new Date(`${followUp}T09:00:00Z`) : null;

  const existing = await prisma.blackBookContact.findUnique({ where: { email } });
  if (!existing) {
    await prisma.blackBookContact.create({
      data: { company, name, email, siteIds, notes: notes && `${today()}: ${notes}`, followUpDate },
    });
    revalidatePath("/");
    return { ok: true, message: `Added ${company} to the Black Book.` };
  }

  // Merge: titles union (either side being "all" wins), notes appended with
  // the date so the history of requests survives, blanks never overwrite.
  const mergedSites =
    existing.siteIds.length === 0 || siteIds.length === 0
      ? []
      : [...new Set([...existing.siteIds, ...siteIds])];
  const mergedNotes = notes
    ? [existing.notes, `${today()}: ${notes}`].filter(Boolean).join("\n")
    : existing.notes;

  await prisma.blackBookContact.update({
    where: { id: existing.id },
    data: {
      company,
      name: name || existing.name,
      siteIds: mergedSites,
      notes: mergedNotes,
      followUpDate: followUpDate || existing.followUpDate,
    },
  });
  revalidatePath("/");
  return { ok: true, message: `${email} was already in the Black Book, so this was merged into that entry.` };
}

export async function deleteBlackBookContact(id) {
  await requireEditor();
  await prisma.blackBookContact.delete({ where: { id: String(id) } });
  revalidatePath("/");
}
