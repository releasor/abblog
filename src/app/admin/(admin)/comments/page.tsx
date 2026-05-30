"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Check, X, Trash2 } from "lucide-react";
import { truncate } from "@/lib/text";
import { SkeletonRow } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { SimplePagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActionButton } from "@/components/action-button";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { fetchApi } from "@/lib/fetch-api";

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
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
    });
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    const res = await fetchApi<{ comments: Comment[]; pagination: Pagination }>(`/api/admin/comments?${params}`, { showErrorToast: false });
    if (res.ok) {
      setComments(res.data.comments);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const updateStatus = async (id: number, status: "APPROVED" | "REJECTED") => {
    setActionId(id);
    const result = await fetchApi(`/api/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      errorMessage: "更新评论状态失败",
    });
    setActionId(null);
    if (result.ok) fetchComments();
  };

  const deleteComment = async (id: number) => {
    setActionId(id);
    const result = await fetchApi(`/api/comments/${id}`, {
      method: "DELETE",
      errorMessage: "删除失败",
    });
    setActionId(null);
    if (result.ok) fetchComments();
  };

  const { targetId: deleteTargetId, requestDelete, confirm: confirmDelete, cancel: cancelDelete } = useConfirmDelete(deleteComment);

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

      <FilterTabs
        tabs={tabs}
        active={statusFilter}
        onChange={(key) => {
          setStatusFilter(key);
          setPage(1);
        }}
      />

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
                      <ActionButton
                        variant="success"
                        icon={<Check className="w-4 h-4" />}
                        label="通过评论"
                        onClick={() => updateStatus(comment.id, "APPROVED")}
                        disabled={actionId === comment.id}
                      />
                    )}
                    {comment.status !== "REJECTED" && (
                      <ActionButton
                        icon={<X className="w-4 h-4" />}
                        label="拒绝评论"
                        onClick={() => updateStatus(comment.id, "REJECTED")}
                        disabled={actionId === comment.id}
                      />
                    )}
                    <ActionButton
                      variant="danger"
                      icon={<Trash2 className="w-4 h-4" />}
                      label="删除评论"
                      onClick={() => requestDelete(comment.id)}
                      disabled={actionId === comment.id}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && (
        <SimplePagination
          page={page}
          totalPages={pagination.totalPages}
          totalLabel={`共 ${pagination.total} 条评论`}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="删除评论"
        message="确定要删除这条评论吗？此操作无法撤销。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
