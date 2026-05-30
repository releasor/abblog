import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site-url";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/empty-state";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { name: true } });
  if (!tag) return { title: "标签未找到" };
  return {
    title: `#${tag.name} - 标签`,
    description: `浏览所有标记为 #${tag.name} 的文章`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;

  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: {
      posts: {
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              publishedAt: true,
              readingTime: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
        where: {
          post: { status: "PUBLISHED" },
        },
        orderBy: {
          post: { publishedAt: "desc" },
        },
      },
    },
  });

  if (!tag) {
    notFound();
  }

  const posts = tag.posts.map((pt) => pt.post);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "标签", item: absoluteUrl("/tags") },
      { "@type": "ListItem", position: 3, name: `#${tag.name}`, item: absoluteUrl(`/tags/${slug}`) },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-1">标签</p>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          #{tag.name}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          共 {posts.length} 篇文章
        </p>
      </div>

      {posts.length === 0 ? (
        <EmptyState compact message="暂无此标签的文章" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              title={post.title}
              slug={post.slug}
              excerpt={post.excerpt}
              category={post.category}
              publishedAt={post.publishedAt}
              readingTime={post.readingTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
