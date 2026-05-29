"use client";

import ErrorFallback from "@/components/error-fallback";

export default function BookmarksError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="收藏夹加载失败" message="无法加载收藏夹内容，请稍后再试。" />;
}
