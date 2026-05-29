"use client";

import ErrorFallback from "@/components/error-fallback";

export default function GroupsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} title="圈子加载失败" message="无法加载圈子列表，请稍后再试。" />;
}
