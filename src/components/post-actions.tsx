"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface PostActionsProps {
  postId: number;
}

export function PostActions({ postId }: PostActionsProps) {
  const { data: session } = useSession();
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [liking, setLiking] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [likeRes, bookmarkRes] = await Promise.all([
        fetch(`/api/posts/${postId}/like`),
        fetch(`/api/posts/${postId}/bookmark`),
      ]);

      if (likeRes.ok) {
        const data = await likeRes.json();
        setLikeCount(data.count);
        setIsLiked(data.isLiked);
      }

      if (bookmarkRes.ok) {
        const data = await bookmarkRes.json();
        setIsBookmarked(data.isBookmarked);
      }
    } catch {}
  }, [postId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleLike = async () => {
    if (!session) return;
    setLiking(true);
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setIsLiked(data.isLiked);
      setLikeCount(data.count);
    }
    setLiking(false);
  };

  const toggleBookmark = async () => {
    if (!session) return;
    const res = await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setIsBookmarked(data.isBookmarked);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {session ? (
        <button
          onClick={toggleLike}
          disabled={liking}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isLiked
              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          <svg className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </Link>
      )}

      {session ? (
        <button
          onClick={toggleBookmark}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isBookmarked
              ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>收藏</span>
        </button>
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>收藏</span>
        </Link>
      )}
    </div>
  );
}
