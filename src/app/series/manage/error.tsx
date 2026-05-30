"use client";

import ErrorFallback from "@/components/error-fallback";

export default function SeriesManageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="加载失败" message="无法加载系列管理页面，请稍后再试。" />;
}
