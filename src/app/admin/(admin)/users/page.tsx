"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Search, Users, Star } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { DataTable } from "@/components/data-table";
import { fetchApi } from "@/lib/fetch-api";

import { SimplePagination } from "@/components/pagination";

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await fetchApi<{ users: User[]; pagination: { totalPages: number } }>(
      `/api/admin/users?page=${page}&q=${encodeURIComponent(debouncedQuery)}`,
      { errorMessage: "加载用户列表失败" }
    );
    setLoading(false);
    if (result.ok) {
      setUsers(result.data.users || []);
      setTotalPages(result.data.pagination?.totalPages || 1);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: number, role: string) => {
    const result = await fetchApi("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId, action: "setRole", value: role }),
      errorMessage: "角色修改失败",
    });
    if (result.ok) fetchUsers();
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
          aria-label="搜索用户"
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition-shadow"
        />
      </div>

      <DataTable
        columns={[
          {
            key: "user",
            label: "用户",
            render: (u) => (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.avatar ? (
                    <Image
                      src={u.avatar}
                      alt={u.name}
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                      loading="lazy"
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
            ),
          },
          {
            key: "role",
            label: "角色",
            render: (u) => (
              <select
                value={u.role}
                onChange={(e) => {
                  e.stopPropagation();
                  handleRoleChange(u.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`修改 ${u.name} 的角色`}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border-0 ${roleColors[u.role]} cursor-pointer`}
              >
                {Object.entries(roleLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            ),
          },
          {
            key: "level",
            label: "等级",
            hideOnMobile: true,
            render: (u) => (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Lv.{u.level}
                </span>
                <span className="text-xs text-zinc-400">({u.points})</span>
              </div>
            ),
          },
          {
            key: "stats",
            label: "统计",
            hideOnMobile: true,
            render: (u) => (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {u._count.posts} 文 / {u._count.comments} 评
              </span>
            ),
          },
          {
            key: "createdAt",
            label: "注册时间",
            hideOnMobile: true,
            render: (u) => (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(u.createdAt)}
              </span>
            ),
          },
        ]}
        data={users}
        loading={loading}
        loadingRows={5}
        emptyIcon={<Users className="w-8 h-8" />}
        emptyMessage="未找到用户"
        keyExtractor={(u) => u.id}
      />

      <SimplePagination
        page={page}
        totalPages={totalPages}
        totalLabel={`第 ${page} 页，共 ${totalPages} 页`}
        onPageChange={setPage}
      />
    </div>
  );
}
