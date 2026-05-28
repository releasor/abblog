"use client";

import { useState, useEffect, useCallback, memo } from "react";

interface Comment {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
}

interface CommentListProps {
  postId: number;
  refreshKey?: number;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const CommentItem = memo(function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          {comment.authorName}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-500">
          {formatRelativeTime(comment.createdAt)}
        </span>
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
        {comment.content}
      </p>
    </div>
  );
});

export function CommentList({ postId, refreshKey }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch {
      // Silently fail — comments are non-critical
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments, refreshKey]);

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        加载评论中...
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        还没有评论，来分享你的想法吧！
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
