"use client";

import { useState, useEffect, Suspense, memo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { formatMonthDay } from "@/lib/format-date";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { fetchApi } from "@/lib/fetch-api";

interface Conversation {
  id: number;
  otherUser: { id: number; name: string; username: string | null; avatar: string | null } | null;
  lastMessage: { content: string; sender: { id: number; name: string }; createdAt: string } | null;
  updatedAt: string;
  lastReadAt: string | null;
}

const isUnread = (conv: Conversation) => {
  if (!conv.lastMessage || !conv.lastReadAt) return !!conv.lastMessage;
  return new Date(conv.lastMessage.createdAt) > new Date(conv.lastReadAt);
};

function ConversationSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Skeleton className="h-9 w-16 mb-8" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("user");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    let cancelled = false;
    async function load() {
      if (targetUserId) {
        const result = await fetchApi<{ id: number }>("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ targetUserId }),
          errorMessage: "创建会话失败",
        });
        if (!cancelled && result.ok && result.data.id) router.push(`/messages/${result.data.id}`);
        return;
      }

      const result = await fetchApi<Conversation[]>("/api/conversations", { errorMessage: "加载会话列表失败" });
      if (!cancelled) {
        setLoading(false);
        if (result.ok && Array.isArray(result.data)) setConversations(result.data);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [status, targetUserId, router]);

  if (status !== "authenticated" || loading) {
    return <ConversationSkeleton />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">私信</h1>

      {conversations.length === 0 ? (
        <EmptyState message="暂无私信" description="访问其他用户的个人主页可以发送私信" />
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                isUnread(conv)
                  ? "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <UserAvatar name={conv.otherUser?.name || "?"} avatar={conv.otherUser?.avatar} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${isUnread(conv) ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>
                    {conv.otherUser?.name || "未知用户"}
                  </span>
                  {conv.lastMessage && (
                    <time className="text-xs text-zinc-400">
                      {formatMonthDay(conv.lastMessage.createdAt)}
                    </time>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className={`text-sm truncate mt-0.5 ${isUnread(conv) ? "text-zinc-700 dark:text-zinc-300 font-medium" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {conv.lastMessage.sender.name}: {conv.lastMessage.content}
                  </p>
                )}
              </div>
              {isUnread(conv) && (
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(function MessagesPage() {
  return (
    <Suspense fallback={<ConversationSkeleton />}>
      <MessagesContent />
    </Suspense>
  );
});
