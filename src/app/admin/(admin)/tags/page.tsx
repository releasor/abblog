"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { SkeletonRow } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { fetchApi } from "@/lib/fetch-api";

interface TagItem {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const result = await fetchApi<TagItem[]>("/api/tags", { showErrorToast: false });
    setLoading(false);
    if (result.ok) setTags(result.data);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    const result = await fetchApi<{ error?: string }>("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: newName }),
      showErrorToast: false,
    });
    setCreating(false);

    if (result.ok) {
      setNewName("");
      fetchTags();
    } else {
      setCreateError(result.error);
    }
  };

  const handleSave = async (id: number) => {
    setSaving(true);

    const result = await fetchApi(`/api/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: editName }),
      errorMessage: "保存标签失败",
    });
    setSaving(false);

    if (result.ok) {
      setEditId(null);
      setEditName("");
      fetchTags();
    }
  };

  const { targetId: deleteTargetId, requestDelete, confirm: confirmDelete, cancel: cancelDelete, isDeleting } = useConfirmDelete(async (id: number) => {
    const result = await fetchApi(`/api/tags/${id}`, {
      method: "DELETE",
      errorMessage: "删除失败",
    });
    if (result.ok) fetchTags();
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        标签管理
      </h1>

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-start gap-3">
        <div className="flex-1 w-full sm:max-w-sm">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入标签名称..."
            maxLength={50}
            required
            aria-label="新标签名称"
            className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition-shadow"
          />
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
      ) : tags.length === 0 ? (
        <EmptyState icon={<Tag className="w-8 h-8" />} message="还没有标签，创建一个吧" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="group flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {editId === tag.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    aria-label={`编辑标签 ${tag.name}`}
                    className="px-2 py-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-24 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(tag.id);
                      if (e.key === "Escape") {
                        setEditId(null);
                        setEditName("");
                      }
                    }}
                  />
                  <button
                    onClick={() => handleSave(tag.id)}
                    disabled={saving}
                    aria-label="保存"
                    className="p-1 rounded text-emerald-500 hover:text-emerald-600"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditId(null);
                      setEditName("");
                    }}
                    aria-label="取消"
                    className="p-1 rounded text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    #{tag.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {tag._count.posts}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditId(tag.id);
                        setEditName(tag.name);
                      }}
                      className="p-2 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      aria-label={`编辑 ${tag.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => requestDelete(tag.id)}
                      disabled={isDeleting}
                      className="p-2 rounded text-zinc-400 hover:text-red-500"
                      aria-label={`删除 ${tag.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="删除标签"
        message="确定要删除此标签吗？该标签会从所有文章中移除。此操作无法撤销。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
