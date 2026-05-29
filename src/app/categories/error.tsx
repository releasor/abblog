"use client";

import ErrorFallback from "@/components/error-fallback";

export default function CategoriesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="分类加载失败" message="无法加载分类列表，请稍后再试。" />;
}
