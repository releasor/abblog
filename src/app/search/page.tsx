import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { highlightTerms } from "@/lib/highlight";
import { formatDate } from "@/lib/format-date";
import { stripHtml } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import Link from "next/link";

export const metadata: Metadata = {
  title: "搜索",
  description: "搜索文章内容",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() || "";

  if (!query) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <PageHeader title="搜索" />
        <p className="text-zinc-500 dark:text-zinc-500 text-center py-12">
          请输入搜索关键词
        </p>
      </div>
    );
  }

  type SearchResult = {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    publishedAt: Date | null;
    categoryName: string | null;
    categorySlug: string | null;
    readingTime: number;
  };

  let results: SearchResult[] = [];

  try {
    const rows: SearchResult[] = await prisma.$queryRaw`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.content,
        p.published_at AS publishedAt,
        p.reading_time AS readingTime,
        c.name AS categoryName,
        c.slug AS categorySlug
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE
        p.status = 'PUBLISHED'
        AND MATCH(p.title, p.content) AGAINST(${query} IN NATURAL LANGUAGE MODE)
      ORDER BY MATCH(p.title, p.content) AGAINST(${query} IN NATURAL LANGUAGE MODE) DESC
      LIMIT 20
    `;

    results = rows.map((r) => ({
      ...r,
      readingTime: r.readingTime || 1,
    }));
  } catch {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <PageHeader title="搜索" />
        <p className="text-red-500 text-center py-12">
          搜索失败，请重试。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <PageHeader title="搜索" description={`找到 ${results.length} 条关于 "${query}" 的结果`} />

      {results.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-500 dark:text-zinc-500 mb-4">
            未找到匹配的文章
          </p>
          <Link
            href="/posts"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
          >
            浏览所有文章
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((post) => (
            <SearchResultCard
              key={post.id}
              title={post.title}
              slug={post.slug}
              excerpt={
                post.excerpt
                  ? highlightTerms(post.excerpt, query)
                  : highlightTerms(
                      stripHtml(post.content).slice(0, 200),
                      query
                    )
              }
              category={
                post.categoryName && post.categorySlug
                  ? { name: post.categoryName, slug: post.categorySlug }
                  : null
              }
              publishedAt={post.publishedAt}
              readingTime={post.readingTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({
  title,
  slug,
  excerpt,
  category,
  publishedAt,
  readingTime,
}: {
  title: string;
  slug: string;
  excerpt: string;
  category: { name: string; slug: string } | null;
  publishedAt: Date | null;
  readingTime: number;
}) {
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
      <p
        className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:rounded-sm [&_mark]:px-0.5"
        dangerouslySetInnerHTML={{ __html: excerpt }}
      />
      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
        {publishedAt && (
          <time dateTime={publishedAt.toISOString()}>
            {formatDate(publishedAt)}
          </time>
        )}
        <span>{readingTime} 分钟阅读</span>
      </div>
    </Link>
  );
}
