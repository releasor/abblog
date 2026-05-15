import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { PostCard } from "@/components/post-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 6,
    include: {
      category: { select: { name: true, slug: true } },
    },
  });

  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl mb-4">
          KitTest
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          A personal blog for developers — thoughts on code, tools, and building things that matter.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-8">
          Recent Posts
        </h2>

        {posts.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-500 text-center py-12">
            No posts yet. Check back soon!
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
                readingTime={estimateReadingTime(post.content)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
