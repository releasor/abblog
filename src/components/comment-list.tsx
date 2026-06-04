"use client";

import { useState, useEffect, memo } from "react";
import { formatRelativeTime } from "@/lib/format-date";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { fetchApi } from "@/lib/fetch-api";

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

export const CommentList = memo(function CommentList({ postId, refreshKey }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      const res = await fetchApi<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
      if (!cancelled) {
        if (res.ok) setComments(res.data.comments);
        setLoading(false);
      }
    }
    loadComments();
    return () => { cancelled = true; };
  }, [postId, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-200 dark:border-zinc-800 pb-6 last:border-0 last:pb-0">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return <EmptyState compact message="还没有评论，来分享你的想法吧！" />;
  }

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
});
