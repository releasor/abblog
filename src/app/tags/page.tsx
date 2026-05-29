import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "标签云",
  description: "所有标签及文章数量",
};

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { posts: true },
      },
    },
    orderBy: { posts: { _count: "desc" } },
  });

  const maxCount = Math.max(...tags.map((t) => t._count.posts), 1);

  const getFontSize = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return "text-3xl";
    if (ratio > 0.6) return "text-2xl";
    if (ratio > 0.4) return "text-xl";
    if (ratio > 0.2) return "text-lg";
    return "text-base";
  };

  const getOpacity = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.6) return "opacity-100";
    if (ratio > 0.3) return "opacity-80";
    return "opacity-60";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          标签云
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          共 {tags.length} 个标签
        </p>
      </header>

      {tags.length === 0 ? (
        <EmptyState message="暂无标签" />
      ) : (
      <div className="flex flex-wrap gap-3 justify-center mb-12">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/tags/${tag.slug}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ${getFontSize(tag._count.posts)} ${getOpacity(tag._count.posts)}`}
          >
            #{tag.name}
            <span className="text-xs opacity-60">({tag._count.posts})</span>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
