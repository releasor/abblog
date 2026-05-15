"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PostForm from "@/components/post-form";

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
        setError("Post not found");
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
    return <div className="text-center py-12 text-zinc-500">Loading...</div>;
  }

  if (error || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 mb-4">{error || "Post not found"}</p>
        <button
          onClick={() => router.push("/admin/posts")}
          className="text-zinc-900 dark:text-zinc-100 underline"
        >
          Back to posts
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Edit Post
      </h1>
      <PostForm mode="edit" initialData={post} />
    </div>
  );
}
