import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format-date";
import { BookOpen, Calendar } from "lucide-react";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const series = await prisma.postSeries.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!series) return { title: "系列未找到" };

  return {
    title: series.name,
    description: series.description || undefined,
  };
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params;

  const series = await prisma.postSeries.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, username: true } },
      posts: {
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              publishedAt: true,
              coverImageUrl: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!series) notFound();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
            <BookOpen className="w-4 h-4" />
            <span>系列文章</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            {series.name}
          </h1>
          {series.description && (
            <p className="text-zinc-600 dark:text-zinc-400">{series.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-zinc-500">
            <span>作者：{series.user.name}</span>
            <span>{series.posts.length} 篇文章</span>
          </div>
        </div>

        <div className="space-y-4">
          {series.posts.map((sp, i) => (
            <Link
              key={sp.id}
              href={`/posts/${sp.post.slug}`}
              className="flex gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {i + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  {sp.post.title}
                </h3>
                {sp.post.excerpt && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {sp.post.excerpt}
                  </p>
                )}
                {sp.post.publishedAt && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-zinc-500">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {formatDate(sp.post.publishedAt)}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
