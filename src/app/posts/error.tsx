"use client";

import ErrorFallback from "@/components/error-fallback";

export default function PostsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="文章加载失败" message="无法加载文章列表，请稍后再试。" />;
}
