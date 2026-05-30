"use client";

import { useState, useEffect, memo } from "react";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";

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
    fetchApi<{ score: number; userVote: number | null }>(`/api/posts/${postId}/vote`, { showErrorToast: false })
      .then((result) => {
        if (result.ok) {
          if (result.data.score !== undefined) setScore(result.data.score);
          if (result.data.userVote !== undefined) setVote(result.data.userVote);
        }
      });
  }, [postId]);

  async function handleVote(value: number) {
    if (loading) return;
    setLoading(true);
    const result = await fetchApi<{ score: number; userVote: number | null }>(`/api/posts/${postId}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
      errorMessage: "投票失败",
    });
    setLoading(false);
    if (result.ok) {
      if (result.data.score !== undefined) setScore(result.data.score);
      if (result.data.userVote !== undefined) setVote(result.data.userVote);
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
