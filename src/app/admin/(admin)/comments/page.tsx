"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: number;
  authorName: string;
  authorEmail: string;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  post: { id: number; title: string; slug: string };
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

    const res = await fetch(`/api/comments?${params}`);
    const data = await res.json();
    setComments(data.comments);
    setPagination(data.pagination);
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const updateStatus = async (id: number, status: "APPROVED" | "REJECTED") => {
    setActionId(id);
    const res = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      fetchComments();
    }
    setActionId(null);
  };

  const deleteComment = async (id: number) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    setActionId(id);
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchComments();
    }
    setActionId(null);
  };

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + "..." : text;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
      APPROVED: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
      REJECTED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ""}`}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Comments</h1>
      </div>

      <div className="flex gap-1 mb-4">
        {["all", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">No comments found.</div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Post</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Author</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Comment</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <tr key={comment.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                    {truncate(comment.post.title, 40)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {comment.authorName}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {truncate(comment.content, 80)}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(comment.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {comment.status !== "APPROVED" && (
                        <button
                          onClick={() => updateStatus(comment.id, "APPROVED")}
                          disabled={actionId === comment.id}
                          className="px-3 py-1 text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 border border-green-300 dark:border-green-700 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {comment.status !== "REJECTED" && (
                        <button
                          onClick={() => updateStatus(comment.id, "REJECTED")}
                          disabled={actionId === comment.id}
                          className="px-3 py-1 text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 border border-yellow-300 dark:border-yellow-700 rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        onClick={() => deleteComment(comment.id)}
                        disabled={actionId === comment.id}
                        className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} comments
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  p === page
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
