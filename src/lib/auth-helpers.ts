import type { Session } from "next-auth";

type SessionLike = Session | { user?: Record<string, unknown> | null } | null;

export function getAuthUserId(session: SessionLike): number | null {
  const id = (session?.user as Record<string, unknown> | null)?.id as string | undefined;
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}

export function getAuthUserRole(session: SessionLike): string | null {
  return ((session?.user as Record<string, unknown> | null)?.role as string | undefined) ?? null;
}

export function isAdmin(session: SessionLike): boolean {
  return getAuthUserRole(session) === "admin";
}

export function getAuthUsername(session: SessionLike): string | null {
  return ((session?.user as Record<string, unknown> | null)?.username as string | undefined) ?? null;
}
