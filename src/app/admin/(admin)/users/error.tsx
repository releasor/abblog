"use client";

import ErrorFallback from "@/components/error-fallback";

export default function AdminUsersError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
