"use client";

import { useState, useEffect, memo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, ChevronUp, ChevronDown, Save } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/fetch-api";

interface SeriesPost {
  id: number;
  order: number;
  post: { id: number; title: string; slug: string; publishedAt: string | null };
}

interface UserPost {
  id: number;
  title: string;
  slug: string;
}

export default memo(function ManageSeriesPostsPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [series, setSeries] = useState<{ id: number; name: string; slug: string } | null>(null);
  const [posts, setPosts] = useState<SeriesPost[]>([]);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    async function loadSeries() {
      const result = await fetchApi<{ id: number; name: string; slug: string; posts: SeriesPost[] }>(`/api/series/${slug}`, { showErrorToast: false });
      if (!cancelled) {
        setLoading(false);
        if (result.ok) {
          setSeries({ id: result.data.id, name: result.data.name, slug: result.data.slug });
          setPosts(result.data.posts || []);
        }
      }
    }
    loadSeries();
    return () => { cancelled = true; };
  }, [status, slug, router]);

  const fetchUserPosts = async () => {
    const result = await fetchApi<{ posts: UserPost[] }>("/api/user/posts?limit=100", { showErrorToast: false });
    if (result.ok) setUserPosts(result.data.posts || []);
  };

  const handleAddPost = async (postId: number) => {
    if (!series || submitting) return;
    setSubmitting(true);

    const result = await fetchApi<{ id: number; order: number }>(`/api/series/${series.id}/posts`, {
      method: "POST",
      body: JSON.stringify({ postId }),
      successMessage: "文章已添加到系列",
      errorMessage: "添加失败",
    });
    setSubmitting(false);

    if (result.ok) {
      const post = userPosts.find((p) => p.id === postId);
      if (post) {
        setPosts((prev) => [...prev, { ...result.data, post: { id: post.id, title: post.title, slug: post.slug, publishedAt: null } }]);
      }
    }
  };

  const handleRemovePost = async (postId: number) => {
    if (!series || submitting) return;
    setSubmitting(true);

    const result = await fetchApi(`/api/series/${series.id}/posts/${postId}`, {
      method: "DELETE",
      successMessage: "文章已从系列中移除",
      errorMessage: "移除失败",
    });
    setSubmitting(false);
    if (result.ok) setPosts((prev) => prev.filter((p) => p.post.id !== postId));
  };

  const movePost = (index: number, direction: "up" | "down") => {
    const newPosts = [...posts];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPosts.length) return;
    const current = newPosts[index];
    const target = newPosts[targetIndex];
    if (current && target) {
      newPosts[index] = target;
      newPosts[targetIndex] = current;
    }
    setPosts(newPosts);
  };

  const handleSaveOrder = async () => {
    if (!series) return;
    setSaving(true);
    const order = posts.map((p) => p.post.id);
    await fetchApi(`/api/series/${series.id}/posts`, {
      method: "PATCH",
      body: JSON.stringify({ order }),
      successMessage: "排序已保存",
      errorMessage: "保存失败",
    });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <EmptyState compact message="系列未找到" />
      </div>
    );
  }

  const availablePosts = userPosts.filter((p) => !posts.some((sp) => sp.post.id === p.id));

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/series/manage"
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            管理系列文章
          </h1>
          <p className="text-sm text-zinc-500">{series.name}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShowAdd(!showAdd);
            if (!showAdd && userPosts.length === 0) fetchUserPosts();
          }}
          aria-expanded={showAdd}
        >
          <Plus className="w-3.5 h-3.5" />
          添加文章
        </Button>
        {posts.length > 1 && (
          <Button
            size="sm"
            onClick={handleSaveOrder}
            loading={saving}
          >
            <Save className="w-3.5 h-3.5" />
            保存排序
          </Button>
        )}
      </div>

      {/* Add Post Panel */}
      {showAdd && (
        <div className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">选择要添加的文章</h3>
          {availablePosts.length === 0 ? (
            <p className="text-sm text-zinc-500">没有可添加的文章</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {availablePosts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddPost(p.id)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {p.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <EmptyState compact message="系列中还没有文章" />
      ) : (
        <div className="space-y-2">
          {posts.map((sp, index) => (
            <div
              key={sp.id}
              className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => movePost(index, "up")}
                  disabled={index === 0}
                  aria-label="上移"
                  className="p-0.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => movePost(index, "down")}
                  disabled={index === posts.length - 1}
                  aria-label="下移"
                  className="p-0.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="w-6 text-center text-sm font-medium text-zinc-400">
                {index + 1}
              </span>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/posts/${sp.post.slug}`}
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline truncate block"
                >
                  {sp.post.title}
                </Link>
              </div>

              <button
                onClick={() => handleRemovePost(sp.post.id)}
                className="p-1.5 text-zinc-400 hover:text-red-500 rounded transition-colors"
                aria-label="从系列中移除"
                title="从系列中移除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
