"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { FileText, Users, MessageSquare, Eye, TrendingUp, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { SkeletonStat } from "@/components/skeleton";
import { fetchApi } from "@/lib/fetch-api";

interface DashboardData {
  summary: {
    totalPosts: number;
    totalUsers: number;
    totalComments: number;
    totalViews: number;
  };
  trend: {
    date: string;
    pageViews: number;
    uniqueUsers: number;
    newPosts: number;
    newComments: number;
    newUsers: number;
  }[];
  popularPosts: {
    id: number;
    title: string;
    slug: string;
    score: number;
    _count: { likes: number; comments: number };
  }[];
}

function calcTrend(trend: DashboardData["trend"], key: keyof DashboardData["trend"][number]): { value: number; isPositive: boolean } {
  if (trend.length < 2) return { value: 0, isPositive: true };
  const half = Math.floor(trend.length / 2);
  const prev = trend.slice(half).reduce((s, d) => s + (d[key] as number), 0);
  const curr = trend.slice(0, half).reduce((s, d) => s + (d[key] as number), 0);
  if (prev === 0) return { value: curr > 0 ? 100 : 0, isPositive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { value: Math.abs(pct), isPositive: pct >= 0 };
}

export default memo(function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      const result = await fetchApi<DashboardData>("/api/admin/stats", { errorMessage: "加载统计数据失败" });
      if (!cancelled) {
        setLoading(false);
        if (result.ok) setData(result.data);
      }
    }
    loadStats();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          仪表盘
        </h1>
        <SkeletonStat count={4} />
      </div>
    );
  }

  if (!data) return null;

  const { summary, trend, popularPosts } = data;
  const trendPosts = calcTrend(trend, "newPosts");
  const trendUsers = calcTrend(trend, "newUsers");
  const trendComments = calcTrend(trend, "newComments");
  const trendViews = calcTrend(trend, "pageViews");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        仪表盘
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="已发布文章"
          value={summary.totalPosts}
          icon={FileText}
          trend={trendPosts}
        />
        <StatCard
          label="注册用户"
          value={summary.totalUsers}
          icon={Users}
          trend={trendUsers}
        />
        <StatCard
          label="评论总数"
          value={summary.totalComments}
          icon={MessageSquare}
          trend={trendComments}
        />
        <StatCard
          label="阅读次数"
          value={summary.totalViews}
          icon={Eye}
          trend={trendViews}
        />
      </div>

      {/* Popular Posts */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            热门文章
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {popularPosts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              暂无数据
            </div>
          ) : (
            popularPosts.map((post, i) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-zinc-400 w-5 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {post.title}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <span className="text-xs text-zinc-400">
                    {post._count.likes} 赞
                  </span>
                  <span className="text-xs text-zinc-400">
                    {post._count.comments} 评论
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
