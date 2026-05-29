"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/skeleton";

const PostForm = dynamic(() => import("@/components/post-form"), {
  loading: () => (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  ),
});

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
