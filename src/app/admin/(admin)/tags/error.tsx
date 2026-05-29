"use client";

import ErrorFallback from "@/components/error-fallback";

export default function AdminTagsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
