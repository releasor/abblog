import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "分类",
  description: "按分类浏览文章",
};

export const revalidate = 3600;

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "分类",
    description: "按分类浏览文章",
    url: absoluteUrl("/categories"),
    hasPart: categories.map((category) => ({
      "@type": "Thing",
      name: category.name,
      url: absoluteUrl(`/categories/${category.slug}`),
    })),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHeader title="分类" />

      {categories.length === 0 ? (
        <EmptyState message="暂无分类。" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group block rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors mb-2">
                {category.name}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                {category._count.posts} 篇文章
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
