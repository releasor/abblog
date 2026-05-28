"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";

interface Conversation {
  id: number;
  otherUser: { id: number; name: string; username: string | null; avatar: string | null } | null;
  lastMessage: { content: string; sender: { id: number; name: string }; createdAt: string } | null;
  updatedAt: string;
  lastReadAt: string | null;
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

    // If target user specified, create/find conversation and redirect
    if (targetUserId) {
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            router.push(`/messages/${data.id}`);
          }
        })
        .catch(() => {});
      return;
    }

    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        setConversations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, targetUserId]);

  const isUnread = (conv: Conversation) => {
    if (!conv.lastMessage || !conv.lastReadAt) return !!conv.lastMessage;
    return new Date(conv.lastMessage.createdAt) > new Date(conv.lastReadAt);
  };

  if (status !== "authenticated" || loading) {
    return <div className="max-w-2xl mx-auto px-4 py-12 text-center text-zinc-500">加载中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">私信</h1>

      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">暂无私信</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">访问其他用户的个人主页可以发送私信</p>
        </div>
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
                      {new Date(conv.lastMessage.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
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

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-center text-zinc-500">加载中...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
