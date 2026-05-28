"use client";

import { useState } from "react";
import { CommentList } from "./comment-list";
import { CommentForm } from "./comment-form";

interface CommentSectionProps {
  postId: number;
}

export function CommentSection({ postId }: CommentSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        评论
      </h2>
      <CommentList postId={postId} refreshKey={refreshKey} />
      <div className="mt-8">
        <CommentForm postId={postId} onCommentAdded={() => setRefreshKey((k) => k + 1)} />
      </div>
    </section>
  );
}
