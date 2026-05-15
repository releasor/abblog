"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TiptapEditor from "./tiptap-editor";
import { slugify } from "@/lib/slugify";

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

export default function PostForm({ mode, initialData }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [slugEdited, setSlugEdited] = useState(mode === "edit");
  const [content, setContent] = useState(initialData?.content || "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.coverImageUrl || "");
  const [categoryId, setCategoryId] = useState<string>(initialData?.categoryId?.toString() || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.tags?.map((t) => t.id.toString()) || []
  );
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initialData?.status || "DRAFT");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([cats, tgs]) => {
      setCategories(cats);
      setTags(tgs);
    });
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

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

    const url = mode === "create" ? "/api/posts" : `/api/posts/${initialData?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      return;
    }

    router.push("/admin/posts");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Title
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
          Slug
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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Content
        </label>
        <TiptapEditor content={content} onChange={setContent} />
      </div>

      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Excerpt
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
        <label htmlFor="coverImage" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Cover Image URL
        </label>
        <input
          id="coverImage"
          type="text"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Category
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            <option value="">None</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Status
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
              Draft
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
              Published
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Tags
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
            placeholder="Create new tag..."
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
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Post" : "Update Post"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/posts")}
          className="px-6 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
