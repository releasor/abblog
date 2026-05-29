"use client";

import { useEffect, useRef, memo } from "react";

export const ReadingTracker = memo(function ReadingTracker({ postId }: { postId: number }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    const timer = setTimeout(() => {
      tracked.current = true;
      fetch(`/api/posts/${postId}/read`, { method: "POST" })
        .catch((e) => console.error("[ReadingTracker] Failed to record read:", e));
    }, 5000);

    return () => clearTimeout(timer);
  }, [postId]);

  return null;
});
