import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";
import { PostsSidebar } from "@/components/posts-sidebar";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "所有文章",
  description: "浏览所有已发布的文章",
};

export const revalidate = 120;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 12;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        readingTime: true,
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  if (page > totalPages && totalPages > 0) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "所有文章",
    description: "浏览所有已发布的文章",
    url: absoluteUrl("/posts"),
    numberOfItems: total,
    hasPart: posts.map((post) => ({
      "@type": "Article",
      headline: post.title,
      url: absoluteUrl(`/posts/${post.slug}`),
      ...(post.excerpt && { description: post.excerpt }),
      ...(post.publishedAt && { datePublished: post.publishedAt.toISOString() }),
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHeader title="所有文章" />

      <div className="flex gap-8">
        <div className="flex-1 min-w-0">
          {posts.length === 0 ? (
            <EmptyState compact message="暂无已发布的文章" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <Pagination currentPage={page} totalPages={totalPages} basePath="/posts" />
            </>
          )}
        </div>

        <PostsSidebar />
      </div>
    </div>
  );
}
