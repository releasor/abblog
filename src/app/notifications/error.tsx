"use client";

import ErrorFallback from "@/components/error-fallback";

export default function NotificationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} message="加载通知时发生了错误，请稍后再试。" />;
}
