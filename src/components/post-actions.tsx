"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Heart, Bookmark } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";
import { BookmarkPicker } from "@/components/bookmark-picker";

interface PostActionsProps {
  postId: number;
}

export const PostActions = memo(function PostActions({ postId }: PostActionsProps) {
  const { data: session } = useSession();
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [liking, setLiking] = useState(false);

  const fetchStatus = useCallback(async (cancelled?: { current: boolean }) => {
    const [likeResult, bookmarkResult] = await Promise.all([
      fetchApi<{ count: number; isLiked: boolean }>(`/api/posts/${postId}/like`, { showErrorToast: false }),
      fetchApi<{ isBookmarked: boolean }>(`/api/posts/${postId}/bookmark`, { showErrorToast: false }),
    ]);
    if (!cancelled?.current) {
      if (likeResult.ok) {
        setLikeCount(likeResult.data.count);
        setIsLiked(likeResult.data.isLiked);
      }
      if (bookmarkResult.ok) {
        setIsBookmarked(bookmarkResult.data.isBookmarked);
      }
    }
  }, [postId]);

  useEffect(() => {
    const cancelled = { current: false };
    fetchStatus(cancelled);
    return () => { cancelled.current = true; };
  }, [fetchStatus]);

  const toggleLike = useCallback(async () => {
    if (!session) return;
    setLiking(true);
    const result = await fetchApi<{ isLiked: boolean; count: number }>(`/api/posts/${postId}/like`, {
      method: "POST",
      errorMessage: "点赞失败",
    });
    setLiking(false);
    if (result.ok) {
      setIsLiked(result.data.isLiked);
      setLikeCount(result.data.count);
    }
  }, [session, postId]);

  return (
    <div className="flex items-center gap-4">
      {session ? (
        <button
          onClick={toggleLike}
          disabled={liking}
          aria-label={isLiked ? "取消点赞" : "点赞"}
          aria-pressed={isLiked}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isLiked
              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Heart className="w-4 h-4" />
          {likeCount > 0 && <span>{likeCount}</span>}
        </Link>
      )}

      {session ? (
        <BookmarkPicker postId={postId} initialBookmarked={isBookmarked} />
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Bookmark className="w-4 h-4" />
          <span>收藏</span>
        </Link>
      )}
    </div>
  );
});
