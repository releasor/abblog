"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, Plus, Folder, Trash2, Edit2 } from "lucide-react";
import { showToast } from "@/components/toast";

interface Collection {
  id: number;
  name: string;
  description?: string | null;
  isDefault: boolean;
  items: {
    id: number;
    post: {
      id: number;
      title: string;
      slug: string;
      excerpt?: string | null;
      coverImageUrl?: string | null;
    };
  }[];
}

export default function BookmarksPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    try {
      const res = await fetch("/api/bookmarks/collections");
      const data = await res.json();
      setCollections(data.collections || []);
      if (data.collections?.length > 0 && activeCollection === null) {
        setActiveCollection(data.collections[0].id);
      }
    } catch {
      showToast("加载收藏夹失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/bookmarks/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        setShowNew(false);
        fetchCollections();
      } else {
        showToast("创建收藏夹失败", "error");
      }
    } catch {
      showToast("创建收藏夹失败", "error");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除此收藏夹？")) return;
    try {
      await fetch(`/api/bookmarks/collections/${id}`, { method: "DELETE" });
      if (activeCollection === id) setActiveCollection(null);
      fetchCollections();
    } catch {
      showToast("删除收藏夹失败", "error");
    }
  }

  async function handleRemoveItem(collectionId: number, postId: number) {
    try {
      await fetch(`/api/bookmarks/collections/${collectionId}/items?postId=${postId}`, {
        method: "DELETE",
      });
      fetchCollections();
    } catch {
      showToast("移除书签失败", "error");
    }
  }

  const currentCollection = collections.find((c) => c.id === activeCollection);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">我的收藏</h1>

        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-2">
              <button
                onClick={() => setShowNew(!showNew)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                <span>新建收藏夹</span>
              </button>

              {showNew && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="收藏夹名称"
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                  />
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="描述（可选）"
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                  />
                  <button
                    onClick={handleCreate}
                    className="w-full px-2 py-1 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  >
                    创建
                  </button>
                </div>
              )}

              {collections.map((col) => (
                <div
                  key={col.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
                    activeCollection === col.id
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setActiveCollection(col.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm truncate">{col.name}</span>
                    <span className="text-xs text-zinc-500">{col.items.length}</span>
                  </div>
                  {!col.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(col.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {currentCollection ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentCollection.name}
                  </h2>
                  <span className="text-sm text-zinc-500">{currentCollection.items.length} 篇</span>
                </div>

                {currentCollection.items.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500">
                    <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>收藏夹为空</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentCollection.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                      >
                        {item.post.coverImageUrl && (
                          <img
                            src={item.post.coverImageUrl}
                            alt=""
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/posts/${item.post.slug}`}
                            className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                          >
                            {item.post.title}
                          </Link>
                          {item.post.excerpt && (
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">
                              {item.post.excerpt}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(currentCollection.id, item.post.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 self-start"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-zinc-500">
                <p>选择一个收藏夹</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
