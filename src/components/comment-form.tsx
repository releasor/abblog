"use client";

import { useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Skeleton } from "@/components/skeleton";

interface CommentFormProps {
  postId: number;
  onCommentAdded?: (comment: { id: number; authorName: string; content: string; createdAt: string }) => void;
}

export function CommentForm({ postId, onCommentAdded }: CommentFormProps) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          登录后即可发表评论
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          登录
        </Link>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          还没有账号？{" "}
          <Link href="/register" className="underline hover:no-underline">
            注册
          </Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!content.trim()) {
      setError("请输入评论内容");
      return;
    }
    if (content.trim().length > 1000) {
      setError("评论不能超过1000个字符");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError("请稍后再提交评论");
        } else if (res.status === 401) {
          setError("请先登录");
        } else {
          setError(data.error || "提交失败，请重试");
        }
        return;
      }

      setSuccess(true);
      setContent("");
      if (onCommentAdded && data.comment) {
        onCommentAdded(data.comment);
      }
    } catch {
      setError("提交失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          发表评论
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {session.user?.name}
        </span>
      </div>

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm text-green-800 dark:text-green-300">
          评论发表成功
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="comment-content" className="sr-only">评论内容</label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="写下你的想法..."
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-y"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500 text-right">
          {content.length}/1000 字符
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {submitting ? "提交中..." : "发表评论"}
      </button>
    </form>
  );
}
