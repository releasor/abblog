"use client";

import ErrorFallback from "@/components/error-fallback";

export default function ArchiveError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} message="加载归档页面时发生了错误" />;
}
