import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { Badge } from "@/components/badge";

interface PostCardProps {
  title: string;
  slug: string;
  excerpt: string | null;
  category: { name: string; slug: string } | null;
  publishedAt: Date | null;
  readingTime: number;
}

export function PostCard({ title, slug, excerpt, category, publishedAt, readingTime }: PostCardProps) {

  return (
    <Link
      href={`/posts/${slug}`}
      className="group block rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        {category && <Badge>{category.name}</Badge>}
      </div>

      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors mb-2">
        {title}
      </h3>

      {excerpt && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
          {excerpt}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
        {publishedAt && <time dateTime={publishedAt.toISOString()}>{formatDate(publishedAt)}</time>}
        <span>{readingTime} 分钟阅读</span>
      </div>
    </Link>
  );
}
