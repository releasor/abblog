"use client";

import ErrorFallback from "@/components/error-fallback";

export default function TopicsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="话题加载失败" message="无法加载话题列表，请稍后再试。" />;
}
