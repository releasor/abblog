"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ImageUpload from "./image-upload";
import { Skeleton } from "./skeleton";

const TiptapEditor = dynamic(() => import("./tiptap-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 rounded-xl" />,
});
import { slugify } from "@/lib/slugify";
import { formatDateTime, formatTime } from "@/lib/format-date";
import { useAutoSave, getDraft, clearDraft } from "@/hooks/use-auto-save";
import { TemplatePicker } from "./template-picker";
import { VersionHistory } from "./version-history";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface PostFormProps {
  mode: "create" | "edit";
  apiEndpoint?: string;
  redirectPath?: string;
  initialData?: {
    id?: number;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    coverImageUrl: string;
    categoryId: number | null;
    tags: { id: number; name: string }[];
    status: "DRAFT" | "PUBLISHED";
  };
}

export default function PostForm({ mode, apiEndpoint, redirectPath, initialData }: PostFormProps) {
  const router = useRouter();
  const draftKey = mode === "create" ? "new-post" : `post-${initialData?.id}`;

  // Load draft for new posts
  const draft = mode === "create" ? getDraft(draftKey) : null;

  const [title, setTitle] = useState(draft?.title || initialData?.title || "");
  const [slug, setSlug] = useState(draft ? slugify(draft.title) : initialData?.slug || "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [content, setContent] = useState(draft?.content || initialData?.content || "");
  const [excerpt, setExcerpt] = useState(draft?.excerpt || initialData?.excerpt || "");
  const [coverImageUrl, setCoverImageUrl] = useState(draft?.coverImageUrl || initialData?.coverImageUrl || "");
  const [categoryId, setCategoryId] = useState<string>(draft?.categoryId || initialData?.categoryId?.toString() || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    draft?.tags || initialData?.tags?.map((t) => t.id.toString()) || []
  );
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initialData?.status || "DRAFT");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDraftNotice, setShowDraftNotice] = useState(!!draft);

  // Auto-save drafts (only for create mode or unsaved edits)
  const { lastSaveTime, hasUnsavedChanges } = useAutoSave(
    draftKey,
    { title, content, excerpt, coverImageUrl, categoryId, tags: selectedTags },
    mode === "create" && (title.length > 0 || content.length > 0)
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/tags").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cats, tgs]) => {
        setCategories(cats);
        setTags(tgs);
      })
      .catch((e) => console.error("[PostForm] Failed to fetch categories/tags:", e));
  }, []);

  useEffect(() => {
    if (!slugEdited && title) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const createTag = async () => {
    if (!newTag.trim()) return;
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTag.trim() }),
      });
      if (res.ok) {
        const tag = await res.json();
        setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedTags((prev) => [...prev, tag.id.toString()]);
        setNewTag("");
      }
    } catch (e) {
      console.error("[PostForm] Failed to create tag:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body = {
        title,
        slug,
        content,
        excerpt,
        coverImageUrl,
        categoryId: categoryId || null,
        tags: selectedTags,
        status,
      };

      const url = apiEndpoint || (mode === "create" ? "/api/posts" : `/api/posts/${initialData?.id}`);
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "保存失败");
        return;
      }

      // Clear draft after successful save
      clearDraft(draftKey);
      router.push(redirectPath || "/admin/posts");
      router.refresh();
    } catch (e) {
      console.error("[PostForm] Failed to save post:", e);
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = () => {
    clearDraft(draftKey);
    setTitle("");
    setContent("");
    setExcerpt("");
    setCoverImageUrl("");
    setCategoryId("");
    setSelectedTags([]);
    setShowDraftNotice(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {showDraftNotice && draft && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 text-sm flex items-center justify-between">
          <span>
            检测到未保存的草稿 (保存于 {formatDateTime(draft.savedAt)})
          </span>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
          >
            丢弃草稿
          </button>
        </div>
      )}

      {/* Auto-save indicator */}
      {mode === "create" && title.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {hasUnsavedChanges ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              未保存
            </span>
          ) : lastSaveTime ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              已自动保存 {formatTime(lastSaveTime)}
            </span>
          ) : null}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          标题
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          URL 别名
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            内容
          </label>
          <TemplatePicker onSelect={(t) => setContent(content + t)} />
        </div>
        <TiptapEditor content={content} onChange={setContent} />
      </div>

      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          摘要
        </label>
        <textarea
          id="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          封面图片
        </label>
        <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            分类
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            <option value="">无</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            状态
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("DRAFT")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                status === "DRAFT"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              草稿
            </button>
            <button
              type="button"
              onClick={() => setStatus("PUBLISHED")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                status === "PUBLISHED"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              已发布
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          标签
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id.toString())}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedTags.includes(tag.id.toString())
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="创建新标签..."
            className="flex-1 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
          />
          <button
            type="button"
            onClick={createTag}
            className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            添加
          </button>
        </div>
      </div>

      {/* Version History (edit mode only) */}
      {mode === "edit" && initialData?.id && (
        <VersionHistory
          postId={initialData.id}
          onRestore={() => {
            router.refresh();
            window.location.reload();
          }}
        />
      )}

      <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中..." : mode === "create" ? "发布文章" : "更新文章"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/posts")}
          className="px-6 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
}
