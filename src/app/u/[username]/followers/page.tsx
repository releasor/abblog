import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { EmptyState } from "@/components/empty-state";

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
    title: `${user.name} 的粉丝 - billionaire`,
    description: `查看 ${user.name} 的粉丝列表`,
  };
}

export default async function FollowersPage({ params }: Props) {
  const { username } = await params;

  const user = await prisma.user.findFirst({
    where: { username },
    select: { id: true, name: true },
  });

  if (!user) {
    notFound();
  }

  const follows = await prisma.follow.findMany({
    where: { followingId: user.id },
    include: {
      follower: {
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

  const followers = follows.map((f) => f.follower);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/u/${username}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回</Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">粉丝</h1>
      </div>
      <div className="space-y-3">
        {followers.length === 0 ? (
          <EmptyState compact message="暂无粉丝" />
        ) : (
          followers.map((follower) => (
            <div key={follower.id} className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Link href={`/u/${follower.username || follower.id}`}>
                <UserAvatar name={follower.name} avatar={follower.avatar} size="lg" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/u/${follower.username || follower.id}`} className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                  {follower.name}
                </Link>
                {follower.bio && <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{follower.bio}</p>}
              </div>
              {follower.username && <FollowButton username={follower.username} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
