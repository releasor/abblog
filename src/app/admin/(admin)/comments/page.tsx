"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Check, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { truncate } from "@/lib/text";
import { SkeletonRow } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";

interface Comment {
  id: number;
  authorName: string;
  authorEmail: string;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  post: { id: number; title: string; slug: string };
  user: { id: number; name: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const res = await fetch(`/api/admin/comments?${params}`);
      const data = await res.json();
      setComments(data.comments);
      setPagination(data.pagination);
    } catch (e) {
      console.error("[AdminComments] Failed to fetch comments:", e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const updateStatus = async (id: number, status: "APPROVED" | "REJECTED") => {
    try {
      setActionId(id);
      const res = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchComments();
    } catch (e) {
      console.error("[AdminComments] Failed to update comment status:", e);
    } finally {
      setActionId(null);
    }
  };

  const deleteComment = async (id: number) => {
    if (!confirm("确定要删除这条评论吗？")) return;
    try {
      setActionId(id);
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (res.ok) fetchComments();
    } catch (e) {
      console.error("[AdminComments] Failed to delete comment:", e);
    } finally {
      setActionId(null);
    }
  };

  const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    PENDING: {
      label: "待审核",
      dot: "bg-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-700 dark:text-amber-400",
    },
    APPROVED: {
      label: "已通过",
      dot: "bg-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-700 dark:text-emerald-400",
    },
    REJECTED: {
      label: "已拒绝",
      dot: "bg-red-500",
      bg: "bg-red-50 dark:bg-red-900/20",
      text: "text-red-700 dark:text-red-400",
    },
  };

  const tabs = [
    { key: "all", label: "全部" },
    { key: "PENDING", label: "待审核" },
    { key: "APPROVED", label: "已通过" },
    { key: "REJECTED", label: "已拒绝" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        评论管理
      </h1>

      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setStatusFilter(key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === key
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRow count={5} height="h-20" />
      ) : comments.length === 0 ? (
        <EmptyState icon={<MessageSquare className="w-8 h-8" />} message="暂无评论" />
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const config = statusConfig[comment.status];
            return (
              <div
                key={comment.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {comment.authorName || comment.user?.name || "匿名"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      {truncate(comment.content, 200)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      评论于{" "}
                      <span className="text-zinc-500 dark:text-zinc-300">
                        {comment.post.title}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {comment.status !== "APPROVED" && (
                      <button
                        onClick={() => updateStatus(comment.id, "APPROVED")}
                        disabled={actionId === comment.id}
                        className="p-2 rounded-lg text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
                        title="通过"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {comment.status !== "REJECTED" && (
                      <button
                        onClick={() => updateStatus(comment.id, "REJECTED")}
                        disabled={actionId === comment.id}
                        className="p-2 rounded-lg text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
                        title="拒绝"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteComment(comment.id)}
                      disabled={actionId === comment.id}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            共 {pagination.total} 条评论
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
