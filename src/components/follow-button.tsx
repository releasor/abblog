"use client";

import { useState, useEffect, memo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/fetch-api";

interface FollowButtonProps {
  username: string;
  onFollowChange?: (isFollowing: boolean, followerCount: number) => void;
}

export const FollowButton = memo(function FollowButton({ username, onFollowChange }: FollowButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkFollow() {
      const result = await fetchApi<{ isFollowing: boolean }>(`/api/users/${username}/follow`, { showErrorToast: false });
      if (result.ok) setIsFollowing(result.data.isFollowing);
    }
    checkFollow();
  }, [username]);

  const toggle = async () => {
    if (!session) {
      router.push("/login");
      return;
    }
    setLoading(true);
    const result = await fetchApi<{ isFollowing: boolean; followerCount: number }>(`/api/users/${username}/follow`, {
      method: "POST",
      errorMessage: "关注操作失败，请稍后重试",
    });
    setLoading(false);
    if (result.ok) {
      setIsFollowing(result.data.isFollowing);
      onFollowChange?.(result.data.isFollowing, result.data.followerCount);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={isFollowing ? `取消关注 ${username}` : `关注 ${username}`}
      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
        isFollowing
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
      }`}
    >
      {isFollowing ? "已关注" : "关注"}
    </button>
  );
});
