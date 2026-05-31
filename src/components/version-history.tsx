"use client";

import { useState, useEffect, memo } from "react";
import { History, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";
import { formatDateTime } from "@/lib/format-date";

interface Version {
  id: number;
  version: number;
  title: string;
  createdAt: string;
}

interface VersionHistoryProps {
  postId: number;
  onRestore?: () => void;
}

export const VersionHistory = memo(function VersionHistory({ postId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    async function loadVersions() {
      const result = await fetchApi<{ versions: Version[] }>(`/api/posts/${postId}/versions`, { errorMessage: "加载版本历史失败" });
      if (result.ok) setVersions(result.data.versions || []);
    }
    loadVersions();
  }, [postId]);

  async function handleRestore(versionId: number) {
    if (restoring) return;
    setRestoring(versionId);
    const result = await fetchApi(`/api/posts/${postId}/versions`, {
      method: "POST",
      body: JSON.stringify({ versionId }),
      successMessage: "版本已恢复",
      errorMessage: "恢复版本失败",
    });
    setRestoring(null);
    if (result.ok) onRestore?.();
  }

  if (versions.length === 0) return null;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center justify-between w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            版本历史 ({versions.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-64 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <div>
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  v{v.version}: {v.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(v.createdAt)}
                </p>
              </div>
              <button
                onClick={() => handleRestore(v.id)}
                disabled={restoring === v.id}
                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{restoring === v.id ? "恢复中..." : "恢复"}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
