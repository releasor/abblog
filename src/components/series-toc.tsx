"use client";

import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

interface SeriesPost {
  id: number;
  order: number;
  post: {
    id: number;
    title: string;
    slug: string;
  };
}

interface SeriesTOCProps {
  series: {
    id: number;
    name: string;
    slug: string;
  };
  posts: SeriesPost[];
  currentPostId: number;
}

export function SeriesTOC({ series, posts, currentPostId }: SeriesTOCProps) {
  const sortedPosts = [...posts].sort((a, b) => a.order - b.order);
  const currentIndex = sortedPosts.findIndex((sp) => sp.post.id === currentPostId);
  const prevPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <Link
        href={`/series/${series.slug}`}
        className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <BookOpen className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{series.name}</span>
        <span className="text-xs text-zinc-500 ml-auto">{sortedPosts.length} 篇</span>
      </Link>

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {sortedPosts.map((sp, i) => (
          <Link
            key={sp.id}
            href={`/posts/${sp.post.slug}`}
            className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
              sp.post.id === currentPostId
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <span className="w-5 text-center text-xs">{i + 1}</span>
            <span className="flex-1 truncate">{sp.post.title}</span>
          </Link>
        ))}
      </div>

      <div className="flex divide-x divide-zinc-200 dark:divide-zinc-800">
        {prevPost ? (
          <Link
            href={`/posts/${prevPost.post.slug}`}
            className="flex items-center gap-1 flex-1 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="truncate">上一篇</span>
          </Link>
        ) : (
          <div className="flex-1 px-4 py-2 text-sm text-zinc-400">-</div>
        )}
        {nextPost ? (
          <Link
            href={`/posts/${nextPost.post.slug}`}
            className="flex items-center justify-end gap-1 flex-1 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <span className="truncate">下一篇</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <div className="flex-1 px-4 py-2 text-sm text-zinc-400 text-right">-</div>
        )}
      </div>
    </div>
  );
}
