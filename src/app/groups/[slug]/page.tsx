"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import Image from "next/image";
import { showToast } from "@/components/toast";
import { formatDate } from "@/lib/format-date";
import { Users, FileText } from "lucide-react";

interface Group {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  isPublic: boolean;
  owner: { id: number; name: string; username?: string | null };
  _count: { members: number; posts: number };
}

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  user: { id: number; name: string; username?: string | null };
}

export default function GroupDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroup();
  }, [slug]);

  async function fetchGroup() {
    try {
      const res = await fetch(`/api/groups?slug=${slug}`);
      if (!res.ok) {
        showToast("加载小组信息失败", "error");
        return;
      }
      const data = await res.json();
      if (data.groups?.length > 0) {
        const g = data.groups[0];
        setGroup(g);

        const postsRes = await fetch(`/api/groups/${g.id}/posts`);
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData.posts || []);
        }

        setIsMember(false);
      }
    } catch {
      showToast("加载小组信息失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!group) return;
    try {
      const method = isMember ? "DELETE" : "POST";
      const res = await fetch(`/api/groups/${group.id}/join`, { method });
      if (res.ok) {
        setIsMember(!isMember);
        fetchGroup();
      } else {
        showToast(isMember ? "退出失败" : "加入失败", "error");
      }
    } catch {
      showToast(isMember ? "退出失败" : "加入失败", "error");
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <p className="text-zinc-500">圈子不存在</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative h-48 rounded-xl overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600" />
          {group.coverImage && (
            <Image src={group.coverImage} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
          )}
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-bold text-white mb-1">{group.name}</h1>
            {!group.isPublic && (
              <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">
                私密圈子
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{group._count.members} 成员</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{group._count.posts} 文章</span>
            </div>
          </div>
          <button
            onClick={handleJoin}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isMember
                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                : "bg-indigo-500 text-white hover:bg-indigo-600"
            }`}
          >
            {isMember ? "退出圈子" : "加入圈子"}
          </button>
        </div>

        {group.description && (
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{group.description}</p>
        )}

        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            圈子文章
          </h2>
          {posts.length === 0 ? (
            <EmptyState compact message="暂无文章" />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  className="block p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-md transition-shadow"
                >
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{post.title}</h3>
                  {post.excerpt && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                    <span>{post.user.name}</span>
                    {post.publishedAt && (
                      <>
                        <span>-</span>
                        <span>{formatDate(post.publishedAt)}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
