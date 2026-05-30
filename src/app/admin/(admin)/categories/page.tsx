"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { SkeletonRow } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { showToast } from "@/components/toast";

interface Category {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories");
      if (!res.ok) return;
      const data = await res.json();
      setCategories(data);
    } catch (e) {
      console.error("[AdminCategories] Failed to fetch categories:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error);
      } else {
        setNewName("");
        fetchCategories();
      }
    } catch (e) {
      console.error("[AdminCategories] Failed to create category:", e);
      setCreateError("创建分类失败");
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id: number) => {
    setEditError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error);
      } else {
        setEditId(null);
        setEditName("");
        fetchCategories();
      }
    } catch (e) {
      console.error("[AdminCategories] Failed to save category:", e);
      setEditError("保存分类失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此分类吗？该分类下的文章将变为未分类。")) return;
    try {
      setDeleteId(id);
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCategories();
      } else {
        showToast("删除失败", "error");
      }
    } catch (e) {
      console.error("[AdminCategories] Failed to delete category:", e);
      showToast("删除失败", "error");
    } finally {
      setDeleteId(null);
    }
  };

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
              className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition-shadow"
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
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
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
                          className="px-2.5 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
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
                  <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                    {category.slug}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {category._count.posts}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {editId === category.id ? (
                        <>
                          <button
                            onClick={() => handleSave(category.id)}
                            disabled={saving}
                            aria-label="保存"
                            className="p-2 rounded-lg text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditId(null);
                              setEditName("");
                              setEditError("");
                            }}
                            aria-label="取消"
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditId(category.id);
                              setEditName(category.name);
                              setEditError("");
                            }}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            aria-label={`编辑 ${category.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            disabled={deleteId === category.id}
                            className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                            aria-label={`删除 ${category.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
}
