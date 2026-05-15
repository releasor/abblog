"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Post {
  id: number;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  category: { name: string } | null;
  tags: { id: number; name: string }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "10",
      sortBy,
      sortOrder,
    });
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    const res = await fetch(`/api/posts?${params}`);
    const data = await res.json();
    setPosts(data.posts);
    setPagination(data.pagination);
    setLoading(false);
  }, [page, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this post? This will also delete all comments and tag associations.")) {
      return;
    }
    setDeleteId(id);
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchPosts();
    }
    setDeleteId(null);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Posts</h1>
        <Link
          href="/admin/posts/new"
          className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          New Post
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex gap-1">
          {["all", "DRAFT", "PUBLISHED"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {s === "all" ? "All" : s === "DRAFT" ? "Draft" : "Published"}
            </button>
          ))}
        </div>

        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split("-");
            setSortBy(by);
            setSortOrder(order);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        >
          <option value="createdAt-desc">Newest first</option>
          <option value="createdAt-asc">Oldest first</option>
          <option value="publishedAt-desc">Recently published</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No posts found.{" "}
          <Link href="/admin/posts/new" className="text-zinc-900 dark:text-zinc-100 underline">
            Create one
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Title</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Published</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{post.title}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-500">/posts/{post.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      post.status === "PUBLISHED"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {post.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {post.category?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deleteId === post.id}
                        className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                      >
                        {deleteId === post.id ? "Deleting..." : "Delete"}
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
            {pagination.total} posts
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
