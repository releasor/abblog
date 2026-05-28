import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
      include: {
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  if (page > totalPages && totalPages > 0) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        所有文章
      </h1>

      {posts.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-500 text-center py-12">
          暂无已发布的文章。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                title={post.title}
                slug={post.slug}
                excerpt={post.excerpt}
                category={post.category}
                publishedAt={post.publishedAt}
                readingTime={estimateReadingTime(post.content)}
              />
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} basePath="/posts" />
        </>
      )}
    </div>
  );
}
