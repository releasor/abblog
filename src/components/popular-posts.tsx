"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";

interface PopularPost {
  id: number;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  score: number;
}

export const PopularPosts = memo(function PopularPosts() {
  const [posts, setPosts] = useState<PopularPost[]>([]);
  const [period, setPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    fetch(`/api/posts/popular?period=${period}&limit=5`)
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => { if (Array.isArray(data)) setPosts(data); })
      .catch((e) => console.error("[PopularPosts] Failed to fetch popular posts:", e));
  }, [period]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">热门文章</h3>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setPeriod("week")}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              period === "week"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            周榜
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              period === "month"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            月榜
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {posts.map((post, i) => (
          <Link
            key={post.id}
            href={`/posts/${post.slug}`}
            className="flex items-center gap-3 group"
          >
            <span className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
              i < 3
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
            }`}>
              {i + 1}
            </span>
            <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors line-clamp-1">
              {post.title}
            </span>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无数据</p>
        )}
      </div>
    </div>
  );
});
