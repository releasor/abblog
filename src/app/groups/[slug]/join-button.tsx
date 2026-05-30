"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fetchApi } from "@/lib/fetch-api";

interface JoinGroupButtonProps {
  groupId: number;
}

export function JoinGroupButton({ groupId }: JoinGroupButtonProps) {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      fetchApi<{ isMember: boolean }>(`/api/groups/${groupId}/membership`, { showErrorToast: false })
        .then((result) => { if (result.ok) setIsMember(result.data.isMember); });
    }
  }, [session, groupId]);

  async function handleJoin() {
    if (!session) return;
    setLoading(true);
    const result = await fetchApi(`/api/groups/${groupId}/join`, {
      method: isMember ? "DELETE" : "POST",
      errorMessage: isMember ? "退出失败" : "加入失败",
    });
    setLoading(false);
    if (result.ok) setIsMember(!isMember);
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
