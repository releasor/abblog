"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/fetch-api";
import { formatDate } from "@/lib/format-date";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

interface UserPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  author?: { name: string } | null;
  user?: { name: string; username: string } | null;
}

const TAB_LABELS: Record<string, string> = {
  posts: "文章",
  likes: "点赞",
  bookmarks: "收藏",
};

const TAB_EMPTY_MSG: Record<string, string> = {
  posts: "暂无文章",
  likes: "暂无点赞",
  bookmarks: "暂无收藏",
};

export const ProfileTabs = memo(function ProfileTabs({ username }: { username: string }) {
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [tab, setTab] = useState<"posts" | "likes" | "bookmarks">("posts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      try {
        const res = await fetchApi<UserPost[]>(`/api/users/${username}/posts?tab=${tab}`, { showErrorToast: false });
        if (!cancelled && res.ok) setPosts(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPosts();
    return () => { cancelled = true; };
  }, [tab, username]);

  return (
    <>
      <div className="flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="内容分类">
        {(["posts", "likes", "bookmarks"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <EmptyState compact message={TAB_EMPTY_MSG[tab]} />
        ) : (
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="block p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all"
            >
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{post.title}</h3>
              {post.excerpt && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{post.excerpt}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {post.author && <span>{post.author.name}</span>}
                {post.user && <span>{post.user.name}</span>}
                {post.publishedAt && (
                  <>
                    <span>·</span>
                    <span>{formatDate(post.publishedAt)}</span>
                  </>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
});
