import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { PostContent } from "./post-content";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicPostPage({ params }: PageProps) {
  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      author: { select: { name: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") {
    notFound();
  }

  const readingTime = estimateReadingTime(post.content);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      {post.coverImageUrl && (
        <div className="mb-8">
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-auto rounded-lg object-cover max-h-96"
          />
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatDate(post.publishedAt)}
            </time>
          )}
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>{readingTime} min read</span>
          {post.category && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">
                {post.category.name}
              </span>
            </>
          )}
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>By {post.author.name}</span>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((pt) => (
              <Link
                key={pt.tag.id}
                href={`/tags/${pt.tag.slug}`}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                #{pt.tag.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {post.excerpt && (
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 italic border-l-4 border-zinc-300 dark:border-zinc-700 pl-4">
          {post.excerpt}
        </p>
      )}

      <PostContent content={post.content} />
    </article>
  );
}
