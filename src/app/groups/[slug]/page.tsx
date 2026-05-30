import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/format-date";
import { Users, FileText } from "lucide-react";
import { JoinGroupButton } from "./join-button";

export const revalidate = 600;

export async function generateStaticParams() {
  const groups = await prisma.group.findMany({
    where: { isPublic: true },
    select: { slug: true },
  });
  return groups.map((g) => ({ slug: g.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const group = await prisma.group.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!group) return { title: "圈子不存在" };

  return {
    title: `${group.name} - 圈子`,
    description: group.description || `加入${group.name}圈子，与志同道合的人交流`,
  };
}

export default async function GroupDetailPage({ params }: Props) {
  const { slug } = await params;

  const group = await prisma.group.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, name: true, username: true } },
      _count: { select: { members: true, posts: true } },
    },
  });

  if (!group) {
    notFound();
  }

  const groupPosts = await prisma.groupPost.findMany({
    where: { groupId: group.id },
    include: {
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const posts = groupPosts.map((gp) => gp.post);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative h-48 rounded-xl overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600" />
          {group.coverImage && (
            <Image src={group.coverImage} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
          )}
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-bold text-white mb-1">{group.name}</h1>
            {!group.isPublic && (
              <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">
                私密圈子
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{group._count.members} 成员</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{group._count.posts} 文章</span>
            </div>
          </div>
          <JoinGroupButton groupId={group.id} />
        </div>

        {group.description && (
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{group.description}</p>
        )}

        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            圈子文章
          </h2>
          {posts.length === 0 ? (
            <EmptyState compact message="暂无文章" />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  className="block p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-md transition-shadow"
                >
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{post.title}</h3>
                  {post.excerpt && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                    {post.user && <span>{post.user.name}</span>}
                    {post.publishedAt && (
                      <>
                        <span>-</span>
                        <span>{formatDate(post.publishedAt)}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
