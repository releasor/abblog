"use client";

import ErrorFallback from "@/components/error-fallback";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="后台加载失败" message="后台管理页面加载时发生错误，请稍后再试。" />;
}
