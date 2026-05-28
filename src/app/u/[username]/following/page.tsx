"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";

interface FollowUser {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
}

export default function FollowingPage() {
  const params = useParams();
  const username = params.username as string;
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${username}/following`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-12 text-center text-zinc-500">加载中...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/u/${username}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回</Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">关注</h1>
      </div>
      <div className="space-y-3">
        {users.length === 0 ? (
          <p className="text-center text-zinc-500 dark:text-zinc-400 py-12">暂无关注</p>
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
