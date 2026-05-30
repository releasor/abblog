"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MessageCircle, Zap, Trash2, Copy, Check } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";
import { Skeleton } from "@/components/skeleton";
import { useCopyToClipboard } from "@/hooks/use-copy";

type Tab = "chat" | "optimizer";

export default function PromptsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chat");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  if (status !== "authenticated") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6" role="tablist" aria-label="功能切换">
        <button
          onClick={() => setTab("chat")}
          role="tab"
          aria-selected={tab === "chat"}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
            tab === "chat"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          AI 对话
        </button>
        <button
          onClick={() => setTab("optimizer")}
          role="tab"
          aria-selected={tab === "optimizer"}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
            tab === "optimizer"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Zap className="w-4 h-4" />
          提示词优化
        </button>
      </div>

      {tab === "chat" ? <ChatTab /> : <OptimizerTab />}
    </div>
  );
}

/* ======================== AI Chat Tab ======================== */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMsg }],
          mode: "chat",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "请求失败，请重试" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "请求失败，请重试" }]);
    }
    setLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <div className="h-[500px] overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950 flex-1 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">和 AI 聊聊吧</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-md"
                : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-bl-md"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="清空对话"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="输入消息..."
            aria-label="消息内容"
            className="flex-1 px-4 py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================== Optimizer Tab ======================== */

function OptimizerTab() {
  const [input, setInput] = useState("");
  const [optimized, setOptimized] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOptimize = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setOptimized("");

    const result = await fetchApi<{ optimized: string }>("/api/prompts/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
      errorMessage: "优化失败",
    });
    setLoading(false);
    if (result.ok) setOptimized(result.data.optimized || "优化失败");
  };

  const { copied, copy } = useCopyToClipboard();
  const copyResult = () => copy(optimized);

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入您的原始提示词..."
          aria-label="原始提示词"
          className="w-full h-48 p-4 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleOptimize}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
        >
          <Zap className="w-4 h-4" />
          {loading ? "优化中..." : "AI 优化"}
        </button>
      </div>

      {optimized && (
        <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-800">
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">优化结果</span>
            <button
              onClick={copyResult}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "已复制!" : "复制"}
            </button>
          </div>
          <div className="p-4 max-h-[400px] overflow-auto">
            <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
              {optimized}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
