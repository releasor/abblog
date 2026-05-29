"use client";

import ErrorFallback from "@/components/error-fallback";

export default function TimelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="动态加载失败" message="无法加载动态列表，请稍后再试。" />;
}
