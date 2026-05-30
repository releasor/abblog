"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Bookmark, Plus, Check } from "lucide-react";
import { showToast } from "./toast";

interface Collection {
  id: number;
  name: string;
  isDefault: boolean;
  items?: { postId: number }[];
}

interface BookmarkPickerProps {
  postId: number;
  initialBookmarked?: boolean;
}

export const BookmarkPicker = memo(function BookmarkPicker({ postId, initialBookmarked = false }: BookmarkPickerProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const closePicker = useCallback(() => setShowPicker(false), []);

  useEffect(() => {
    if (!showPicker) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPicker, closePicker]);

  useEffect(() => {
    if (showPicker) {
      fetch("/api/bookmarks/collections")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setCollections(data.collections || []); })
        .catch(() => showToast("加载收藏夹失败", "error"));
    }
  }, [showPicker]);

  async function handleQuickBookmark() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setIsBookmarked(data.isBookmarked);
      } else {
        showToast("收藏失败", "error");
      }
    } catch {
      showToast("收藏失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCollection(collectionId: number) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookmarks/collections/${collectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        setIsBookmarked(true);
        setShowPicker(false);
      } else {
        showToast("添加到收藏夹失败", "error");
      }
    } catch {
      showToast("添加到收藏夹失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center">
        <button
          onClick={handleQuickBookmark}
          disabled={loading}
          className={`p-2 rounded-lg transition-colors ${
            isBookmarked
              ? "text-yellow-500 bg-yellow-500/10"
              : "text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10"
          }`}
          aria-label={isBookmarked ? "取消收藏" : "收藏"}
        >
          <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
        </button>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="选择收藏夹"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {showPicker && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 z-10" role="dialog" aria-modal="true" aria-label="选择收藏夹">
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">添加到收藏夹</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => handleAddToCollection(col.id)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span>{col.name}</span>
                {col.items?.some((item) => item.postId === postId) && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
            {collections.length === 0 && (
              <p className="px-3 py-2 text-sm text-zinc-500">暂无收藏夹</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
