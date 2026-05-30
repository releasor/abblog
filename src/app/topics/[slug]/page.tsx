import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format-date";

export const revalidate = 600;

export async function generateStaticParams() {
  const topics = await prisma.topic.findMany({
    where: { posts: { some: { post: { status: "PUBLISHED" } } } },
    select: { slug: true },
  });
  return topics.map((t) => ({ slug: t.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = await prisma.topic.findUnique({ where: { slug }, select: { name: true, description: true } });
  if (!topic) return { title: "话题未找到" };
  return { title: `#${topic.name}`, description: topic.description || undefined };
}

export default async function TopicDetailPage({ params }: Props) {
  const { slug } = await params;

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      posts: {
        take: 30,
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            select: {
              id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true,
              category: { select: { name: true, slug: true } },
              _count: { select: { likes: true, comments: true } },
            },
          },
        },
      },
    },
  });

  if (!topic) notFound();

  const posts = topic.posts.map((tp) => tp.post);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {topic.coverImage ? (
              <Image src={topic.coverImage} alt="" width={64} height={64} className="rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                {topic.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">#{topic.name}</h1>
              <p className="text-zinc-500">{topic.postCount} 篇文章</p>
            </div>
          </div>
          {topic.description && (
            <p className="text-zinc-600 dark:text-zinc-400">{topic.description}</p>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">暂无相关文章</div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="block p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow"
              >
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{post.title}</h3>
                {post.excerpt && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  {post.category && <span>{post.category.name}</span>}
                  <span>{post._count.likes} 赞</span>
                  <span>{post._count.comments} 评论</span>
                  {post.publishedAt && (
                    <span>{formatDate(post.publishedAt)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
