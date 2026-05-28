"use client";

import { useState, useEffect } from "react";
import { FileText, Users, MessageSquare, Eye, TrendingUp, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";

interface DashboardData {
  summary: {
    totalPosts: number;
    totalUsers: number;
    totalComments: number;
    totalViews: number;
  };
  popularPosts: {
    id: number;
    title: string;
    slug: string;
    score: number;
    _count: { likes: number; comments: number };
  }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 animate-pulse"
            >
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded mb-3" />
              <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, popularPosts } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="已发布文章"
          value={summary.totalPosts}
          icon={FileText}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          label="注册用户"
          value={summary.totalUsers}
          icon={Users}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          label="评论总数"
          value={summary.totalComments}
          icon={MessageSquare}
          trend={{ value: 3, isPositive: false }}
        />
        <StatCard
          label="阅读次数"
          value={summary.totalViews}
          icon={Eye}
          trend={{ value: 15, isPositive: true }}
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
              <a
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
                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
