"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Search, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import { showToast } from "./toast";

interface SEOResult {
  score: number;
  issues: string[];
  suggestions: string[];
  details: {
    titleLength: number;
    excerptLength: number;
    contentLength: number;
    tagCount: number;
    hasCover: boolean;
    hasH2: boolean;
    hasH3: boolean;
  };
}

interface SEOPanelProps {
  postId: number;
}

export const SEOPanel = memo(function SEOPanel({ postId }: SEOPanelProps) {
  const [result, setResult] = useState<SEOResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/seo`);
      const data = await res.json();
      setResult(data);
    } catch {
      showToast("SEO 分析失败", "error");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    analyze();
  }, [analyze]);

  if (loading) {
    return (
      <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const scoreColor = result.score >= 80 ? "text-green-500" : result.score >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Search className="w-4 h-4" />
            SEO 分析
          </h3>
          <button
            onClick={analyze}
            className="text-xs text-indigo-500 hover:text-indigo-600"
          >
            重新分析
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-zinc-200 dark:text-zinc-700"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${result.score}, 100`}
                className={scoreColor}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${scoreColor}`}>
              {result.score}
            </span>
          </div>
          <div className="flex-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <p>标题: {result.details.titleLength} 字符</p>
            <p>摘要: {result.details.excerptLength} 字符</p>
            <p>正文: {result.details.contentLength} 字</p>
            <p>标签: {result.details.tagCount} 个</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {result.issues.length === 0 && result.suggestions.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>SEO 表现良好！</span>
          </div>
        ) : (
          <>
            {result.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-red-600 dark:text-red-400">{issue}</span>
              </div>
            ))}
            {result.suggestions.map((sug, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">{sug}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
