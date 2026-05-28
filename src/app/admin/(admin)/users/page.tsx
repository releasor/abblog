"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Users, Shield, Star } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  role: string;
  points: number;
  level: number;
  createdAt: string;
  _count: { posts: number; comments: number; likes: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?page=${page}&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setUsers(data.users || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [page, query]);

  const handleRoleChange = async (userId: number, role: string) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "setRole", value: role }),
    });
    fetchUsers();
  };

  const roleLabels: Record<string, string> = { USER: "用户", EDITOR: "编辑", ADMIN: "管理员" };
  const roleColors: Record<string, string> = {
    USER: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
    EDITOR: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    ADMIN: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        用户管理
      </h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="搜索用户名、邮箱..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition-shadow"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <Users className="w-8 h-8 text-zinc-400" />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">未找到用户</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  等级
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  统计
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  注册时间
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                            {u.name[0]}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {u.name}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border-0 ${roleColors[u.role]} cursor-pointer`}
                    >
                      {Object.entries(roleLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Lv.{u.level}
                      </span>
                      <span className="text-xs text-zinc-400">({u.points})</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {u._count.posts} 文 / {u._count.comments} 评
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            第 {page} 页，共 {totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
