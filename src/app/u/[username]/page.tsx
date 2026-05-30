"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchApi } from "@/lib/fetch-api";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { formatDate } from "@/lib/format-date";
import { Skeleton } from "@/components/skeleton";
import { ProfileTabs } from "./profile-tabs";

interface UserProfile {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  createdAt: string;
  _count: { followers: number; following: number; posts: number; likes: number };
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const username = params.username as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwn = session?.user && session.user.username === username;

  useEffect(() => {
    fetchApi<UserProfile>(`/api/users/${username}`, { showErrorToast: false })
      .then((res) => {
        if (res.ok) {
          setProfile(res.data);
        } else {
          router.push("/");
        }
      })
      .finally(() => setLoading(false));
  }, [username, router]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-start gap-6 mb-8">
          <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-start gap-6 mb-8">
        <UserAvatar name={profile.name} avatar={profile.avatar} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{profile.name}</h1>
            {!isOwn && session && profile.username && <FollowButton username={profile.username} />}
            {!isOwn && session && (
              <Link
                href={`/messages?user=${profile.id}`}
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

          {profile.username && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">@{profile.username}</p>
          )}

          {profile.bio && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                🔗 {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span>📅 {formatDate(profile.createdAt)} 加入</span>
          </div>

          <div className="flex gap-6 mt-4 text-sm">
            <Link href={`/u/${username}/following`} className="hover:underline">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{profile._count.following}</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">关注</span>
            </Link>
            <Link href={`/u/${username}/followers`} className="hover:underline">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{profile._count.followers}</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">粉丝</span>
            </Link>
            <span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{profile._count.posts}</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">文章</span>
            </span>
          </div>
        </div>
      </div>

      <ProfileTabs username={username} />
    </div>
  );
}
