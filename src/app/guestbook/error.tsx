"use client";

import ErrorFallback from "@/components/error-fallback";

export default function GuestbookError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} message="加载留言墙时发生了错误" />;
}
