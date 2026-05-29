"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDateShort } from "@/lib/format-date";

interface RecommendedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  author: { name: string };
  category: { name: string; slug: string } | null;
}

export function RecommendedPosts({ postId }: { postId: number }) {
  const [posts, setPosts] = useState<RecommendedPost[]>([]);

  useEffect(() => {
    fetch(`/api/posts/recommend?postId=${postId}&limit=4`)
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => { if (Array.isArray(data)) setPosts(data); })
      .catch((e) => console.error("[RecommendedPosts] Failed to fetch recommendations:", e));
  }, [postId]);

  if (posts.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        推荐阅读
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.slug}`}
            className="group flex gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all"
          >
            {post.coverImageUrl ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-lg flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center">
                <span className="text-2xl text-zinc-400 dark:text-zinc-500">文</span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2 text-sm">
                {post.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{post.author.name}</span>
                {post.category && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span>{post.category.name}</span>
                  </>
                )}
                {post.publishedAt && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span>{formatDateShort(post.publishedAt)}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
