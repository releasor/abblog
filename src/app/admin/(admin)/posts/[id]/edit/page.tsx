"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { SkeletonPost } from "@/components/skeleton";

const PostForm = dynamic(() => import("@/components/post-form"), {
  loading: () => <SkeletonPost />,
});

interface PostData {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImageUrl: string;
  categoryId: number | null;
  tags: { id: number; name: string }[];
  status: "DRAFT" | "PUBLISHED";
}

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPost = async () => {
      const res = await fetch(`/api/posts/${params.id}`);
      if (!res.ok) {
        setError("文章未找到");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPost({
        id: data.id,
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt || "",
        coverImageUrl: data.coverImageUrl || "",
        categoryId: data.categoryId,
        tags: data.tags,
        status: data.status,
      });
      setLoading(false);
    };
    fetchPost();
  }, [params.id]);

  if (loading) {
    return <SkeletonPost />;
  }

  if (error || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 mb-4">{error || "文章未找到"}</p>
        <button
          onClick={() => router.push("/admin/posts")}
          className="text-zinc-900 dark:text-zinc-100 underline"
        >
          返回文章列表
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        编辑文章
      </h1>
      <PostForm mode="edit" initialData={post} />
    </div>
  );
}
