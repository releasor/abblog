"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { showToast } from "./toast";

interface FollowButtonProps {
  username: string;
  onFollowChange?: (isFollowing: boolean, followerCount: number) => void;
}

export function FollowButton({ username, onFollowChange }: FollowButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${username}/follow`)
      .then((res) => res.json())
      .then((data) => setIsFollowing(data.isFollowing))
      .catch((e) => console.error("[FollowButton] Failed to fetch follow status:", e));
  }, [username]);

  const toggle = async () => {
    if (!session) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${username}/follow`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
        onFollowChange?.(data.isFollowing, data.followerCount);
      } else {
        showToast("关注操作失败，请稍后重试", "error");
      }
    } catch {
      showToast("关注操作失败，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
        isFollowing
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
      }`}
    >
      {isFollowing ? "已关注" : "关注"}
    </button>
  );
}
