"use client";

import { useState, useEffect, memo } from "react";
import { Star, TrendingUp } from "lucide-react";
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

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  2: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  3: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  4: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  5: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  6: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  7: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  8: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white",
};

function useLevelInfo() {
  const [info, setInfo] = useState<LevelInfo | null>(null);
  useEffect(() => {
    fetchApi<LevelInfo>("/api/user/points").then((res) => {
      if (res.ok) setInfo(res.data);
    });
  }, []);
  return info;
}

export const UserLevelBadge = memo(function UserLevelBadge() {
  const info = useLevelInfo();
  if (!info) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[info.level] || LEVEL_COLORS[1]}`}>
        <Star className="w-3 h-3" />
        Lv.{info.level} {info.levelName}
      </span>
      <span className="text-xs text-zinc-500">{info.points} 积分</span>
    </div>
  );
});

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
