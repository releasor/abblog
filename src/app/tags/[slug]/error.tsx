"use client";

import ErrorFallback from "@/components/error-fallback";

export default function TagDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="标签加载失败" message="无法加载标签详情，请稍后再试。" />;
}
