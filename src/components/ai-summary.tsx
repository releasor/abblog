"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function AiSummary({ postId }: { postId: number }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => { if (data?.summary) setSummary(data.summary); })
      .catch((e) => console.error("[AiSummary] Failed to generate summary:", e))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        AI 正在生成摘要...
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-2">
        <span className="text-sm">✨</span>
        <div>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">AI 摘要</span>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{summary}</p>
        </div>
      </div>
    </div>
  );
}
