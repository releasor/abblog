"use client";

import { useState, useEffect, memo } from "react";
import { TrendingUp } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";

interface LevelInfo {
  points: number;
  level: number;
  levelName: string;
  progress: {
    current: number;
    next: number;
    progress: number;
  };
}

function useLevelInfo() {
  const [info, setInfo] = useState<LevelInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadLevelInfo() {
      const res = await fetchApi<LevelInfo>("/api/user/points");
      if (!cancelled && res.ok) setInfo(res.data);
    }
    loadLevelInfo();
    return () => { cancelled = true; };
  }, []);
  return info;
}

export const UserLevelProgress = memo(function UserLevelProgress() {
  const info = useLevelInfo();

  if (!info) return null;

  return (
    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          等级与积分
        </h3>
        <span className="text-sm text-zinc-500">{info.points} 积分</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold text-indigo-500">Lv.{info.level}</span>
        <span className="text-zinc-600 dark:text-zinc-400">{info.levelName}</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{info.progress.current}</span>
          <span>{info.progress.next}</span>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${info.progress.progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 text-right">
          距下一级还需 {info.progress.next - info.points} 积分
        </p>
      </div>
    </div>
  );
});
