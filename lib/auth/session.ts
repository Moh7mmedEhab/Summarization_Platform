import "server-only";
import { headers } from "next/headers";
import type { Session, User } from "better-auth";
import { auth } from "./auth";

export type AuthSession = { session: Session; user: User };

/** Session for server components / route handlers; null when signed out. */
export async function getSession(): Promise<AuthSession | null> {
  const result = (await auth.api.getSession({ headers: await headers() })) as AuthSession | null;
  return result;
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export const userIdOf = (s: AuthSession): string => s.user.id;
