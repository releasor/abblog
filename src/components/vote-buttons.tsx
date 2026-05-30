"use client";

import { useState, useEffect, memo } from "react";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import { showToast } from "./toast";

interface VoteButtonsProps {
  postId: number;
  initialScore?: number;
  initialVote?: number | null;
}

export const VoteButtons = memo(function VoteButtons({ postId, initialScore = 0, initialVote = null }: VoteButtonsProps) {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<number | null>(initialVote);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}/vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.score !== undefined) setScore(data.score);
        if (data.userVote !== undefined) setVote(data.userVote);
      })
      .catch((e) => console.error("[VoteButtons] Failed to fetch vote status:", e));
  }, [postId]);

  async function handleVote(value: number) {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/posts/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.score !== undefined) setScore(data.score);
        if (data.userVote !== undefined) setVote(data.userVote);
      } else {
        showToast("投票失败", "error");
      }
    } catch {
      showToast("投票失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={loading}
        className={`p-1 rounded transition-colors ${
          vote === 1
            ? "text-orange-500 bg-orange-500/10"
            : "text-zinc-400 hover:text-orange-500 hover:bg-orange-500/10"
        }`}
        aria-label="赞同"
        aria-pressed={vote === 1}
      >
        <ArrowBigUp className="w-6 h-6" />
      </button>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{score}</span>
      <button
        onClick={() => handleVote(-1)}
        disabled={loading}
        className={`p-1 rounded transition-colors ${
          vote === -1
            ? "text-blue-500 bg-blue-500/10"
            : "text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10"
        }`}
        aria-label="反对"
        aria-pressed={vote === -1}
      >
        <ArrowBigDown className="w-6 h-6" />
      </button>
    </div>
  );
});
