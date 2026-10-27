"use server";

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { auth } from "./auth";
import { requireEditor } from "./permissions";

// Sign-in accounts (the User table), managed from App settings → Accounts.
//
// Passwords are stored only as bcrypt hashes, so an existing password can never
// be shown back, to anyone. What these actions can do instead is set a new one:
// typed in, or generated and returned exactly once so the person setting it can
// pass it on. Nothing generated is logged or stored anywhere but the hash.
//
// Two guards on top of requireEditor: you cannot remove your own account, and
// the last admin can be neither demoted nor removed. Either would leave nobody
// able to get back in here.

const PATH = "/settings";
const text = (fd, k) => fd.get(k)?.toString().trim() || "";
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD = 10;
const ROLES = new Set(["admin", "viewer"]);

// No 0/O, 1/l/I: generated passwords get read out over the phone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Four groups of four, e.g. "k7Qm-xR2p-...": about 94 bits, easy to read out. */
function generatePassword() {
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(s);
  }
  return groups.join("-");
}

/** A typed password, or a generated one when the field was left blank. */
function pickPassword(fd) {
  const typed = fd.get("password")?.toString() || "";
  if (!typed) return { password: generatePassword(), generated: true };
  if (typed.length < MIN_PASSWORD) return { error: `Passwords need at least ${MIN_PASSWORD} characters.` };
  return { password: typed, generated: false };
}

async function adminCount() {
  return prisma.user.count({ where: { role: "admin" } });
}

async function me() {
  const session = await auth();
  return session?.user?.id || null;
}

/** Returns { ok, message, password? }. password is set only when generated. */
export async function createAccount(_prev, fd) {
  await requireEditor();
  const name = text(fd, "name");
  const username = text(fd, "username").toLowerCase();
  const role = text(fd, "role") || "viewer";

  if (!name) return { ok: false, message: "Add the person's name." };
  if (!USERNAME_RE.test(username)) {
    return { ok: false, message: "Usernames are 3 to 32 characters: lowercase letters, numbers, dots, dashes or underscores." };
  }
  if (!ROLES.has(role)) return { ok: false, message: "Pick Admin or Read-only." };

  const picked = pickPassword(fd);
  if (picked.error) return { ok: false, message: picked.error };

  if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
    return { ok: false, message: `There is already an account called ${username}.` };
  }

  await prisma.user.create({
    data: { name, username, role, passwordHash: await bcrypt.hash(picked.password, 10) },
  });
  revalidatePath(PATH);
  return {
    ok: true,
    message: `Account created for ${name}. They sign in as ${username}.`,
    password: picked.generated ? picked.password : undefined,
    username,
  };
}

/** Returns { ok, message, password? }. */
export async function resetPassword(_prev, fd) {
  await requireEditor();
  const id = text(fd, "id");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true } });
  if (!user) return { ok: false, message: "That account no longer exists." };

  const picked = pickPassword(fd);
  if (picked.error) return { ok: false, message: picked.error };

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(picked.password, 10) },
  });
  revalidatePath(PATH);
  return {
    ok: true,
    message: `Password changed for ${user.username}.`,
    password: picked.generated ? picked.password : undefined,
    username: user.username,
  };
}

/** Returns { ok, message }. */
export async function setRole(_prev, fd) {
  await requireEditor();
  const id = text(fd, "id");
  const role = text(fd, "role");
  if (!ROLES.has(role)) return { ok: false, message: "Pick Admin or Read-only." };

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, username: true } });
  if (!user) return { ok: false, message: "That account no longer exists." };
  if (user.role === role) return { ok: true, message: "No change." };
  if (user.role === "admin" && (await adminCount()) <= 1) {
    return { ok: false, message: "This is the only admin. Make someone else an admin first." };
  }

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath(PATH);
  return { ok: true, message: `${user.username} is now ${role === "admin" ? "an admin" : "read-only"}.` };
}

/** Returns { ok, message }. */
export async function deleteAccount(_prev, fd) {
  await requireEditor();
  const id = text(fd, "id");
  if (id === (await me())) return { ok: false, message: "You can't remove the account you're signed in with." };

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, username: true } });
  if (!user) return { ok: false, message: "That account no longer exists." };
  if (user.role === "admin" && (await adminCount()) <= 1) {
    return { ok: false, message: "This is the only admin, so it can't be removed." };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath(PATH);
  return { ok: true, message: `${user.username} removed. They lose access on their next page load.` };
}
