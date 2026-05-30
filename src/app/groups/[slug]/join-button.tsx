"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { showToast } from "@/components/toast";

interface JoinGroupButtonProps {
  groupId: number;
}

export function JoinGroupButton({ groupId }: JoinGroupButtonProps) {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      fetch(`/api/groups/${groupId}/membership`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data) setIsMember(data.isMember); })
        .catch((e) => console.error("[JoinButton] Failed to check membership:", e));
    }
  }, [session, groupId]);

  async function handleJoin() {
    if (!session) return;
    setLoading(true);
    try {
      const method = isMember ? "DELETE" : "POST";
      const res = await fetch(`/api/groups/${groupId}/join`, { method });
      if (res.ok) {
        setIsMember(!isMember);
      } else {
        showToast(isMember ? "退出失败" : "加入失败", "error");
      }
    } catch {
      showToast(isMember ? "退出失败" : "加入失败", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        isMember
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
          : "bg-indigo-500 text-white hover:bg-indigo-600"
      }`}
    >
      {loading ? "处理中..." : isMember ? "退出圈子" : "加入圈子"}
    </button>
  );
}
