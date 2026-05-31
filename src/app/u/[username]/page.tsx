import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUsername } from "@/lib/auth-helpers";
import { formatDate } from "@/lib/format-date";
import { absoluteUrl } from "@/lib/site-url";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { ProfileTabs } from "./profile-tabs";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ username: string }>;
}

async function getUser(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      bio: true,
      website: true,
      location: true,
      createdAt: true,
      _count: {
        select: {
          followers: true,
          following: true,
          posts: true,
          likes: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getUser(username);
  if (!user) return { title: "用户不存在" };

  const title = `${user.name} (@${user.username})`;
  const description = user.bio || `${user.name} 的个人主页 · ${user._count.posts} 篇文章 · ${user._count.followers} 位粉丝`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/u/${user.username}`),
      type: "profile",
      ...(user.avatar && { images: [{ url: user.avatar }] }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(user.avatar && { images: [user.avatar] }),
    },
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;
  const [user, session] = await Promise.all([
    getUser(username),
    getServerSession(authOptions),
  ]);

  if (!user) notFound();

  const isOwn = getAuthUsername(session) === username;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: user.name,
    url: absoluteUrl(`/u/${user.username}`),
    ...(user.avatar && { image: user.avatar }),
    ...(user.bio && { description: user.bio }),
    ...(user.website && { sameAs: [user.website] }),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex items-start gap-6 mb-8">
        <UserAvatar name={user.name} avatar={user.avatar} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{user.name}</h1>
            {!isOwn && session && user.username && <FollowButton username={user.username} />}
            {!isOwn && session && (
              <Link
                href={`/messages?user=${user.id}`}
                className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                私信
              </Link>
            )}
            {isOwn && (
              <Link
                href="/settings"
                className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                编辑资料
              </Link>
            )}
          </div>

          {user.username && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">@{user.username}</p>
          )}

          {user.bio && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">{user.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            {user.location && <span>📍 {user.location}</span>}
            {user.website && (
              <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                🔗 {user.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span>📅 {formatDate(user.createdAt)} 加入</span>
          </div>

          <div className="flex gap-6 mt-4 text-sm">
            <Link href={`/u/${username}/following`} className="hover:underline">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user._count.following}</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">关注</span>
            </Link>
            <Link href={`/u/${username}/followers`} className="hover:underline">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user._count.followers}</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">粉丝</span>
            </Link>
            <span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user._count.posts}</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">文章</span>
            </span>
          </div>
        </div>
      </div>

      <ProfileTabs username={username} />
    </div>
  );
}
