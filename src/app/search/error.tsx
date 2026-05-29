"use client";

import ErrorFallback from "@/components/error-fallback";

export default function SearchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="搜索失败" message="搜索过程中发生错误，请稍后再试。" />;
}
