import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { EmptyState } from "@/components/empty-state";

export const revalidate = 60;

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findFirst({
    where: { username },
    select: { name: true },
  });

  if (!user) return { title: "用户不存在" };

  return {
    title: `${user.name} 的关注 - billionaire`,
    description: `查看 ${user.name} 的关注列表`,
  };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;

  const user = await prisma.user.findFirst({
    where: { username },
    select: { id: true, name: true },
  });

  if (!user) {
    notFound();
  }

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const following = follows.map((f) => f.following);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/u/${username}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回</Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">关注</h1>
      </div>
      <div className="space-y-3">
        {following.length === 0 ? (
          <EmptyState compact message="暂无关注" />
        ) : (
          following.map((followed) => (
            <div key={followed.id} className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Link href={`/u/${followed.username || followed.id}`}>
                <UserAvatar name={followed.name} avatar={followed.avatar} size="lg" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/u/${followed.username || followed.id}`} className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                  {followed.name}
                </Link>
                {followed.bio && <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{followed.bio}</p>}
              </div>
              {followed.username && <FollowButton username={followed.username} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
