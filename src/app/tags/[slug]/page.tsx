import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PostCard } from "@/components/post-card";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-1">Tag</p>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          #{tag.name}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-500 text-center py-12">
          No posts with this tag yet.
        </p>
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
