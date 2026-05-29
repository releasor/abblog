"use client";

import ErrorFallback from "@/components/error-fallback";

export default function PromptsError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
