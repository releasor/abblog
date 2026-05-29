"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/toast";
import { formatDateShort } from "@/lib/format-date";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { SimplePagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";

interface Post {
  id: number;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  category: { name: string } | null;
  tags: { id: number; name: string }[];
  pendingComments: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

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

    try {
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts);
      setPagination(data.pagination);
    } catch (e) {
      console.error("[AdminPosts] Failed to fetch posts:", e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: number) => {
    try {
      setDeleteId(id);
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPosts();
      } else {
        showToast("删除失败", "error");
      }
    } catch (e) {
      console.error("[AdminPosts] Failed to delete post:", e);
      showToast("删除失败", "error");
    } finally {
      setDeleteId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          文章管理
        </h1>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建文章
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          tabs={[
            { key: "all", label: "全部" },
            { key: "PUBLISHED", label: "已发布" },
            { key: "DRAFT", label: "草稿" },
          ]}
          active={statusFilter}
          onChange={(key) => {
            setStatusFilter(key);
            setPage(1);
          }}
        />

        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split("-");
            setSortBy(by);
            setSortOrder(order);
            setPage(1);
          }}
          aria-label="排序方式"
          className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
        >
          <option value="createdAt-desc">最新创建</option>
          <option value="createdAt-asc">最早创建</option>
          <option value="publishedAt-desc">最近发布</option>
          <option value="title-asc">标题 A-Z</option>
          <option value="title-desc">标题 Z-A</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={[
          {
            key: "title",
            label: "标题",
            render: (post) => (
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-md">
                    {post.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    /posts/{post.slug}
                  </p>
                </div>
                {post.pendingComments > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {post.pendingComments} 待审
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "status",
            label: "状态",
            render: (post) => (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  post.status === "PUBLISHED"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    post.status === "PUBLISHED"
                      ? "bg-emerald-500"
                      : "bg-zinc-400"
                  }`}
                />
                {post.status === "PUBLISHED" ? "已发布" : "草稿"}
              </span>
            ),
          },
          {
            key: "category",
            label: "分类",
            render: (post) => (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {post.category?.name || "—"}
              </span>
            ),
          },
          {
            key: "date",
            label: "日期",
            render: (post) => (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDateShort(post.publishedAt || post.createdAt) || "—"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "操作",
            className: "text-right",
            render: (post) => (
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/admin/posts/${post.id}/edit`}
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label={`编辑 ${post.title}`}
                >
                  <Pencil className="w-4 h-4" />
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(post.id);
                  }}
                  disabled={deleteId === post.id}
                  className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                  aria-label={`删除 ${post.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ),
          },
        ]}
        data={posts}
        loading={loading}
        loadingRows={5}
        emptyIcon={<FileText className="w-8 h-8" />}
        emptyMessage="还没有文章"
        emptyAction={
          <Link
            href="/admin/posts/new"
            className="text-sm text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            创建第一篇
          </Link>
        }
        keyExtractor={(post) => post.id}
      />

      {/* Pagination */}
      {pagination && (
        <SimplePagination
          page={page}
          totalPages={pagination.totalPages}
          totalLabel={`共 ${pagination.total} 篇文章`}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除文章"
        message="确定要删除这篇文章吗？相关的评论和标签关联也会被删除。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
