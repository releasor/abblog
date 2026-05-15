import Link from "next/link";
import Image from "next/image";

interface RelatedPostData {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
}

interface RelatedPostsProps {
  posts: RelatedPostData[];
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "...";
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-6">
        Related Posts
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.slug}`}
            className="group block rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all"
          >
            {post.coverImageUrl && (
              <div className="relative w-full aspect-[16/9] overflow-hidden">
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {post.category && (
                  <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-xs font-medium">
                    {post.category.name}
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors mb-1.5 line-clamp-2">
                {post.title}
              </h3>

              {post.excerpt && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                  {truncate(post.excerpt, 100)}
                </p>
              )}

              {post.publishedAt && (
                <time
                  dateTime={post.publishedAt.toISOString()}
                  className="text-xs text-zinc-500 dark:text-zinc-500"
                >
                  {formatDate(post.publishedAt)}
                </time>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
