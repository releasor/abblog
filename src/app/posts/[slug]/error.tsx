"use client";

import ErrorFallback from "@/components/error-fallback";

export default function PostDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="文章加载失败" message="无法加载文章内容，请稍后再试。" />;
}
