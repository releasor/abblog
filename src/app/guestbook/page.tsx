"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatRelativeTime } from "@/lib/format-date";
import { fetchApi } from "@/lib/fetch-api";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";

interface Message {
  id: number;
  name: string;
  content: string;
  createdAt: string;
}

export default function GuestbookPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMessages = useCallback(async () => {
    const res = await fetchApi<Message[]>("/api/messages", { showErrorToast: false });
    if (res.ok) setMessages(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setError("");

    const res = await fetchApi<Message>("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        content: content.trim(),
        name: session?.user?.name || name || undefined,
      }),
    });

    setSending(false);

    if (res.ok) {
      setMessages((prev) => [res.data, ...prev]);
      setContent("");
      setName("");
    } else {
      setError(res.error || "发送失败");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        留言墙
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 mb-8">
        在这里留下你的想法、建议或问候
      </p>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mb-10 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        {!session && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你的名字（选填）"
            aria-label="你的名字"
            className="w-full mb-3 px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={session ? `以 ${session.user?.name} 的身份留言...` : "写下你想说的话..."}
          rows={3}
          maxLength={500}
          aria-label="留言内容"
          className="w-full px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-zinc-400">
            {content.length}/500
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="px-5 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {sending ? "发送中..." : "留言"}
            </button>
          </div>
        </div>
      </form>

      {/* Messages list */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-full ml-11" />
            </div>
          ))
        ) : messages.length === 0 ? (
          <EmptyState compact message="还没有留言，来做第一个留言的人吧！" />
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {msg.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {msg.name}
                  </span>
                  <span className="text-xs text-zinc-400 ml-2">
                    {formatRelativeTime(msg.createdAt)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed pl-11">
                {msg.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
