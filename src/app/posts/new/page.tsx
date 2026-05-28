"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PostForm from "@/components/post-form";

export default function NewPostPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-zinc-500">加载中...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        发布新文章
      </h1>
      <PostForm mode="create" apiEndpoint="/api/user/posts" redirectPath="/" />
    </div>
  );
}
