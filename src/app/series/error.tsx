"use client";

import ErrorFallback from "@/components/error-fallback";

export default function SeriesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="系列加载失败" message="无法加载系列列表，请稍后再试。" />;
}
