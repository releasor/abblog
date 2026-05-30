"use client";

import ErrorFallback from "@/components/error-fallback";

export default function NewPostError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="加载失败" message="无法加载编辑器，请稍后再试。" />;
}
