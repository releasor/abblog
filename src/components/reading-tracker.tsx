"use client";

import { useEffect, useRef } from "react";

export function ReadingTracker({ postId }: { postId: number }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    const timer = setTimeout(() => {
      tracked.current = true;
      fetch(`/api/posts/${postId}/read`, { method: "POST" }).catch(() => {});
    }, 5000);

    return () => clearTimeout(timer);
  }, [postId]);

  return null;
}
