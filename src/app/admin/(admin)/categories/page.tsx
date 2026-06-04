"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Folder, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { SkeletonRow } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActionButton } from "@/components/action-button";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { fetchApi } from "@/lib/fetch-api";

interface Category {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

export default memo(function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async (cancelled?: { current: boolean }) => {
    setLoading(true);
    const result = await fetchApi<Category[]>("/api/categories", { showErrorToast: false });
    if (!cancelled?.current) {
      setLoading(false);
      if (result.ok) setCategories(result.data);
    }
  }, []);

  useEffect(() => {
    const cancelled = { current: false };
    fetchCategories(cancelled);
    return () => { cancelled.current = true; };
  }, [fetchCategories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    const result = await fetchApi<{ error?: string }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: newName }),
      showErrorToast: false,
    });
    setCreating(false);

    if (result.ok) {
      setNewName("");
      fetchCategories();
    } else {
      setCreateError(result.error);
    }
  };

  const handleSave = async (id: number) => {
    setEditError("");
    setSaving(true);

    const result = await fetchApi(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: editName }),
      showErrorToast: false,
    });
    setSaving(false);

    if (result.ok) {
      setEditId(null);
      setEditName("");
      fetchCategories();
    } else {
      setEditError(result.error);
    }
  };

  const { targetId: deleteTargetId, requestDelete, confirm: confirmDelete, cancel: cancelDelete, isDeleting } = useConfirmDelete(async (id: number) => {
    const result = await fetchApi(`/api/categories/${id}`, {
      method: "DELETE",
      errorMessage: "删除失败",
    });
    if (result.ok) fetchCategories();
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        分类管理
      </h1>

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-start gap-3">
        <div className="flex-1 w-full sm:max-w-sm">
          <div className="relative">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="输入分类名称..."
              maxLength={50}
              required
              aria-label="新分类名称"
              className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 transition-shadow"
            />
          </div>
          {createError && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {createError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {creating ? "创建中..." : "添加"}
        </button>
      </form>

      {loading ? (
        <SkeletonRow count={4} height="h-14" />
      ) : categories.length === 0 ? (
        <EmptyState icon={<Folder className="w-8 h-8" />} message="还没有分类，创建一个吧" />
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                  Slug
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                  文章数
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    {editId === category.id ? (
                      <div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={50}
                          aria-label={`编辑分类 ${category.name}`}
                          className="px-2.5 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                          autoFocus
                        />
                        {editError && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {editError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {category.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400 font-mono hidden md:table-cell">
                    {category.slug}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                    {category._count.posts}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {editId === category.id ? (
                        <>
                          <ActionButton
                            variant="success"
                            icon={<Check className="w-4 h-4" />}
                            label="保存"
                            onClick={() => handleSave(category.id)}
                            disabled={saving}
                          />
                          <ActionButton
                            icon={<X className="w-4 h-4" />}
                            label="取消"
                            onClick={() => {
                              setEditId(null);
                              setEditName("");
                              setEditError("");
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <ActionButton
                            icon={<Pencil className="w-4 h-4" />}
                            label={`编辑 ${category.name}`}
                            onClick={() => {
                              setEditId(category.id);
                              setEditName(category.name);
                              setEditError("");
                            }}
                          />
                          <ActionButton
                            variant="danger"
                            icon={<Trash2 className="w-4 h-4" />}
                            label={`删除 ${category.name}`}
                            onClick={() => requestDelete(category.id)}
                            disabled={isDeleting}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="删除分类"
        message="确定要删除此分类吗？该分类下的文章将变为未分类。此操作无法撤销。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
});
