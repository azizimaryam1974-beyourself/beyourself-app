import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
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

/** Token für die Handy-App (gleiche Sitzungstabelle, aber ohne Cookie). */
export function issueAppToken(userId: string): { token: string; expiresAt: number } {
  const token = newSessionToken();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  purgeExpiredSessions(db());
  insertAuthSession(db(), hashToken(token), userId, expiresAt);
  return { token, expiresAt };
}

/** Bearer-Token aus dem Authorization-Header (App) – sonst null. */
export async function bearerToken(): Promise<string | null> {
  const h = (await headers()).get("authorization") ?? "";
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(h.trim());
  return m ? m[1] : null;
}

export async function currentUser(): Promise<User | null> {
  const token = (await bearerToken()) ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userForSession(db(), hashToken(token)) ?? null;
}

/** Seitenaufruf eines eingeloggten Nutzers protokollieren – einmal pro Anfrage, nicht bei Formular-Aktionen/Vorabladen. */
const logPageView = cache(async (userId: string) => {
  const h = await headers();
  if (h.get("next-action") || h.get("next-router-prefetch") || h.get("purpose") === "prefetch") return;
  const path = h.get("x-by-path");
  if (!path || path.startsWith("/api/")) return;
  const { audit } = await import("./audit-context");
  await audit("page", "Seite geöffnet", { target: path });
  void userId;
});

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  await logPageView(u.id);
  return u;
}

export async function requireTeacher(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "teacher") redirect("/konto");
  return u;
}
