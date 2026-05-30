"use client";

import { useEffect, useRef, memo } from "react";
import { fetchApi } from "@/lib/fetch-api";

export const ReadingTracker = memo(function ReadingTracker({ postId }: { postId: number }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    const timer = setTimeout(() => {
      tracked.current = true;
      fetchApi(`/api/posts/${postId}/read`, { method: "POST", showErrorToast: false });
    }, 5000);

    return () => clearTimeout(timer);
  }, [postId]);

  return null;
});
