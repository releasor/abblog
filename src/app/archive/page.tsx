import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMonthDay } from "@/lib/format-date";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "文章归档 - billionaire",
  description: "所有已发布文章的时间线归档",
};

export const revalidate = 3600;

export default async function ArchivePage() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      title: true,
      slug: true,
      publishedAt: true,
      category: { select: { name: true } },
    },
  });

  const grouped: Record<number, Record<number, typeof posts>> = {};
  for (const post of posts) {
    if (!post.publishedAt) continue;
    const year = post.publishedAt.getFullYear();
    const month = post.publishedAt.getMonth() + 1;
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];
    grouped[year][month].push(post);
  }

  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          文章归档
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          共 {posts.length} 篇文章
        </p>
      </header>

      <div className="space-y-12">
        {years.map((year) => (
          <div key={year}>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              {year}
            </h2>
            {Object.keys(grouped[year])
              .map(Number)
              .sort((a, b) => b - a)
              .map((month) => (
                <div key={month} className="mb-8">
                  <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                    {month} 月
                  </h3>
                  <div className="space-y-2 border-l-2 border-zinc-200 dark:border-zinc-800 pl-4">
                    {grouped[year][month].map((post) => (
                      <div key={post.slug} className="flex items-baseline gap-3">
                        <time className="text-sm text-zinc-500 dark:text-zinc-500 w-20 flex-shrink-0">
                          {formatMonthDay(post.publishedAt)}
                        </time>
                        <Link
                          href={`/posts/${post.slug}`}
                          className="text-zinc-900 dark:text-zinc-100 hover:underline"
                        >
                          {post.title}
                        </Link>
                        {post.category && (
                          <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full flex-shrink-0">
                            {post.category.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <EmptyState compact message="暂无已发布文章" />
      )}
    </div>
  );
}
