"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { fetchApi } from "@/lib/fetch-api";
import { formatTime } from "@/lib/format-date";
import { Skeleton } from "@/components/skeleton";

interface Message {
  id: number;
  content: string;
  senderId: number;
  createdAt: string;
  sender: { id: number; name: string; avatar: string | null };
}

interface ConversationInfo {
  otherUser: { id: number; name: string; username: string | null; avatar: string | null } | null;
}

function ChatSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div className="flex items-end gap-2 max-w-[70%]">
              {i % 2 === 0 && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
              <Skeleton className={`h-12 ${i % 2 === 0 ? "w-48" : "w-40"} rounded-2xl`} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="h-10 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [info, setInfo] = useState<ConversationInfo | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    async function load() {
      const [convResult, msgResult] = await Promise.all([
        fetchApi<{ id: number; otherUser: ConversationInfo["otherUser"] }[]>("/api/conversations", { showErrorToast: false }),
        fetchApi<Message[]>(`/api/conversations/${conversationId}/messages`, { showErrorToast: false }),
      ]);

      if (convResult.ok) {
        const conv = convResult.data.find((c) => c.id === parseInt(conversationId));
        if (conv) setInfo({ otherUser: conv.otherUser });
      }

      setLoading(false);
      if (msgResult.ok) setMessages(msgResult.data);
    }
    load();
  }, [status, conversationId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    const result = await fetchApi<Message>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
      errorMessage: "发送失败",
    });
    setSending(false);
    if (result.ok) setMessages((prev) => [...prev, result.data]);
  };

  if (status !== "authenticated" || loading) {
    return <ChatSkeleton />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/messages" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回</Link>
        {info?.otherUser && (
          <Link href={`/u/${info.otherUser.username || info.otherUser.id}`} className="flex items-center gap-2 hover:underline">
            <UserAvatar name={info.otherUser.name} avatar={info.otherUser.avatar} size="sm" />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{info.otherUser.name}</span>
          </Link>
        )}
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="h-[500px] overflow-y-auto p-4 space-y-3 bg-zinc-50 dark:bg-zinc-950">
          {messages.length === 0 && (
            <div className="text-center text-sm text-zinc-400 py-12">开始对话吧</div>
          )}
          {messages.map((msg) => {
            const isOwn = String(msg.senderId) === userId;
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                {!isOwn && (
                  <UserAvatar name={msg.sender.name} avatar={msg.sender.avatar} size="sm" />
                )}
                <div className={`max-w-[70%] ${isOwn ? "order-first" : ""}`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    isOwn
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-md"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-bl-md"
                  }`}>
                    {msg.content}
                  </div>
                  <time className={`text-[10px] text-zinc-400 mt-1 block ${isOwn ? "text-right" : ""}`}>
                    {formatTime(msg.createdAt)}
                  </time>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="输入消息..."
              aria-label="消息内容"
              className="flex-1 px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
