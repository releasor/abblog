"use client";

import PostForm from "@/components/post-form";

export default function NewPostPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        新建文章
      </h1>
      <PostForm mode="create" />
    </div>
  );
}
