"use client";

import ErrorFallback from "@/components/error-fallback";

export default function FollowersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} message="加载粉丝列表时发生了错误，请稍后再试。" />;
}
