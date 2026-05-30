export function getAuthUserId(session: { user?: unknown } | null): number | null {
  const id = (session?.user as { id?: string })?.id;
  if (!id) return null;
  const parsed = parseInt(id);
  return isNaN(parsed) ? null : parsed;
}

export function getAuthUserRole(session: { user?: unknown } | null): string | null {
  return (session?.user as { role?: string })?.role ?? null;
}

export function getAuthUsername(session: { user?: unknown } | null): string | null {
  return (session?.user as { username?: string })?.username ?? null;
}
