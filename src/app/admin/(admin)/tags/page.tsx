"use client";

import { useState, useEffect, useCallback } from "react";

interface Tag {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/tags");
    const data = await res.json();
    setTags(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });

    const data = await res.json();
    if (!res.ok) {
      setCreateError(data.error);
    } else {
      setNewName("");
      fetchTags();
    }
    setCreating(false);
  };

  const handleEdit = (tag: Tag) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditError("");
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditError("");
  };

  const handleSave = async (id: number) => {
    setEditError("");
    setSaving(true);

    const res = await fetch(`/api/tags/${id}`, {
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
      fetchTags();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure? This tag will be removed from all posts."
      )
    ) {
      return;
    }
    setDeleteId(id);
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchTags();
    }
    setDeleteId(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Tags
      </h1>

      {/* Inline create form */}
      <form onSubmit={handleCreate} className="mb-6 flex gap-2 items-start">
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New tag name"
            maxLength={50}
            required
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
          {createError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {createError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {creating ? "Creating..." : "Add Tag"}
        </button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No tags yet. Create one above.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Slug
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Posts
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr
                  key={tag.id}
                  className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-4 py-3">
                    {editId === tag.id ? (
                      <div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={50}
                          className="px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
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
                        {tag.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {tag.slug}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {tag._count.posts}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {editId === tag.id ? (
                        <>
                          <button
                            onClick={() => handleSave(tag.id)}
                            disabled={saving}
                            className="px-3 py-1 text-sm text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(tag)}
                            className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(tag.id)}
                            disabled={deleteId === tag.id}
                            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                          >
                            {deleteId === tag.id ? "Deleting..." : "Delete"}
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
