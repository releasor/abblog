"use client";

import { useState, useEffect, memo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Edit3, Trash2, BookOpen, GripVertical, X, Save } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/fetch-api";

interface Series {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  _count: { posts: number };
  posts: { id: number; title: string; slug: string; order: number }[];
}

export default memo(function SeriesManagePage() {
  const { status } = useSession();
  const router = useRouter();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", coverImage: "" });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    async function loadSeries() {
      const result = await fetchApi<{ series: Series[] }>("/api/series?mine=true&limit=50", { showErrorToast: false });
      if (!cancelled) {
        setLoading(false);
        if (result.ok) setSeries(result.data.series || []);
      }
    }
    loadSeries();
    return () => { cancelled = true; };
  }, [status, router]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    if (submitting) return;
    setSubmitting(true);

    const result = await fetchApi<Series>("/api/series", {
      method: "POST",
      body: JSON.stringify(form),
      successMessage: "系列创建成功",
      errorMessage: "创建失败",
    });
    setSubmitting(false);

    if (result.ok) {
      setSeries((prev) => [{ ...result.data, _count: { posts: 0 }, posts: [] }, ...prev]);
      setForm({ name: "", description: "", coverImage: "" });
      setShowCreate(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (submitting) return;
    setSubmitting(true);

    const result = await fetchApi<Partial<Series>>(`/api/series/${id}`, {
      method: "PATCH",
      body: JSON.stringify(form),
      successMessage: "系列更新成功",
      errorMessage: "更新失败",
    });
    setSubmitting(false);

    if (result.ok) {
      setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, ...result.data } : s)));
      setEditingId(null);
      setForm({ name: "", description: "", coverImage: "" });
    }
  };

  const handleDelete = async (id: number) => {
    if (submitting) return;
    setSubmitting(true);

    const result = await fetchApi(`/api/series/${id}`, {
      method: "DELETE",
      successMessage: "系列已删除",
      errorMessage: "删除失败",
    });
    setSubmitting(false);
    setConfirmDelete(null);
    if (result.ok) setSeries((prev) => prev.filter((s) => s.id !== id));
  };

  const startEdit = (s: Series) => {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description || "", coverImage: s.coverImage || "" });
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">我的系列</h1>
          <p className="text-sm text-zinc-500 mt-1">管理你的系列文章，将相关文章组织在一起</p>
        </div>
        <Button
          onClick={() => {
            setShowCreate(true);
            setForm({ name: "", description: "", coverImage: "" });
          }}
          aria-expanded={showCreate}
        >
          <Plus className="w-4 h-4" />
          新建系列
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">新建系列</h3>
            <button onClick={() => setShowCreate(false)} aria-label="关闭" className="text-zinc-400 hover:text-zinc-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="系列名称"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              aria-label="系列名称"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
            />
            <textarea
              placeholder="系列描述（可选）"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              aria-label="系列描述"
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
            />
            <input
              type="text"
              placeholder="封面图片 URL（可选）"
              value={form.coverImage}
              onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
              aria-label="封面图片URL"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                loading={submitting}
              >
                创建
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCreate(false)}
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Series List */}
      {series.length === 0 ? (
        <EmptyState compact message="你还没有创建任何系列" />
      ) : (
        <div className="space-y-4">
          {series.map((s) => (
            <div
              key={s.id}
              className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900"
            >
              {editingId === s.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    aria-label="系列名称"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                  />
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    aria-label="系列描述"
                    rows={2}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                  />
                  <input
                    type="text"
                    value={form.coverImage}
                    onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
                    placeholder="封面图片 URL"
                    aria-label="封面图片URL"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(s.id)}
                      loading={submitting}
                    >
                      <Save className="w-3.5 h-3.5" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setForm({ name: "", description: "", coverImage: "" });
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/series/${s.slug}`}
                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="text-xs text-zinc-500">{s._count.posts} 篇</span>
                    </div>
                    {s.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-1">{s.description}</p>
                    )}
                    {s.posts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.posts.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded"
                          >
                            {p.title}
                          </span>
                        ))}
                        {s.posts.length > 3 && (
                          <span className="text-xs text-zinc-400">+{s.posts.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/series/${s.slug}/manage-posts`}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition-colors"
                      aria-label="管理文章"
                      title="管理文章"
                    >
                      <GripVertical className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => startEdit(s)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition-colors"
                      aria-label="编辑"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(s.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded transition-colors"
                      aria-label="删除"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除系列"
        message="确定要删除这个系列吗？系列中的文章不会被删除。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
});
