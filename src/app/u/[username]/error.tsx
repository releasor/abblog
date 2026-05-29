"use client";

import ErrorFallback from "@/components/error-fallback";

export default function UserProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} message="加载用户主页时发生了错误，请稍后再试。" />;
}
