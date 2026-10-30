import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { hashToken, newSessionToken } from "./password";
import { deleteAuthSession, insertAuthSession, purgeExpiredSessions, userForSession, type User } from "./repo";

export const SESSION_COOKIE = "by_session";
const SESSION_DAYS = 30;

export async function startSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  purgeExpiredSessions(db());
  insertAuthSession(db(), hashToken(token), userId, expires);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteAuthSession(db(), hashToken(token));
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userForSession(db(), hashToken(token)) ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireTeacher(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "teacher") redirect("/konto");
  return u;
}
