"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { EmptyState } from "@/components/empty-state";
import { showToast } from "@/components/toast";
import { Skeleton } from "@/components/skeleton";

interface FollowUser {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
}

export default function FollowersPage() {
  const params = useParams();
  const username = params.username as string;
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${username}/followers`)
      .then((res) => {
        if (res.ok) return res.json();
        showToast("加载粉丝列表失败", "error");
        return [];
      })
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .catch((e) => {
        console.error("[Followers] Failed to fetch followers list:", e);
        showToast("加载粉丝列表失败", "error");
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Skeleton className="h-4 w-16 mb-6" />
        <Skeleton className="h-9 w-32 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/u/${username}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回</Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">粉丝</h1>
      </div>
      <div className="space-y-3">
        {users.length === 0 ? (
          <EmptyState compact message="暂无粉丝" />
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Link href={`/u/${user.username || user.id}`}>
                <UserAvatar name={user.name} avatar={user.avatar} size="lg" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/u/${user.username || user.id}`} className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                  {user.name}
                </Link>
                {user.bio && <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user.bio}</p>}
              </div>
              {user.username && <FollowButton username={user.username} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
