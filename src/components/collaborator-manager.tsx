"use client";

import { useState, useEffect, memo } from "react";
import Image from "next/image";
import { UserPlus, X, Shield, Eye } from "lucide-react";
import { showToast } from "./toast";

interface Collaborator {
  id: number;
  userId: number;
  role: string;
  user: {
    id: number;
    name: string;
    username?: string | null;
    avatar?: string | null;
  };
}

interface CollaboratorManagerProps {
  postId: number;
  isAuthor: boolean;
}

export const CollaboratorManager = memo(function CollaboratorManager({ postId, isAuthor }: CollaboratorManagerProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}/collaborators`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCollaborators(data))
      .catch(() => showToast("加载协作者失败", "error"));
  }, [postId]);

  async function handleAdd() {
    if (!username.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: username, role }),
      });
      if (res.ok) {
        const data = await res.json();
        setCollaborators([...collaborators, data]);
        setUsername("");
        setShowAdd(false);
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "添加协作者失败", "error");
      }
    } catch {
      showToast("添加协作者失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: number) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/collaborators?userId=${userId}`, { method: "DELETE" });
      if (res.ok) {
        setCollaborators(collaborators.filter((c) => c.userId !== userId));
      } else {
        showToast("移除协作者失败", "error");
      }
    } catch {
      showToast("移除协作者失败", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthor && collaborators.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">协作者</h4>
        {isAuthor && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-sm text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            <span>添加</span>
          </button>
        )}
      </div>

      {showAdd && (
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名或ID"
            className="flex-1 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="协作者角色"
            className="px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
          >
            <option value="EDITOR">编辑</option>
            <option value="VIEWER">查看</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={loading || !username.trim()}
            className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
          >
            添加
          </button>
        </div>
      )}

      <div className="space-y-2">
        {collaborators.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                {c.user.avatar ? (
                  <Image src={c.user.avatar} alt={c.user.name} width={32} height={32} className="rounded-full" />
                ) : (
                  <span className="text-sm font-medium">{c.user.name[0]}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.user.name}</p>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  {c.role === "EDITOR" ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  <span>{c.role === "EDITOR" ? "编辑" : "查看"}</span>
                </div>
              </div>
            </div>
            {isAuthor && (
              <button
                onClick={() => handleRemove(c.userId)}
                className="p-1 text-zinc-400 hover:text-red-500"
                aria-label={`移除 ${c.user.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
