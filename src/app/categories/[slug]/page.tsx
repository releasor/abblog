import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site-url";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/empty-state";

export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    where: { posts: { some: { status: "PUBLISHED" } } },
    select: { slug: true },
  });
  return categories.map((c) => ({ slug: c.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug }, select: { name: true, slug: true } });
  if (!category) return { title: "分类未找到" };

  const description = `浏览 ${category.name} 分类下的所有文章`;
  const url = absoluteUrl(`/categories/${category.slug}`);

  return {
    title: `${category.name} - 分类`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${category.name} - 分类`,
      description,
      url,
      type: "website",
      siteName: "billionaire",
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          readingTime: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (!category) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    url: absoluteUrl(`/categories/${slug}`),
    numberOfItems: category.posts.length,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "分类", item: absoluteUrl("/categories") },
      { "@type": "ListItem", position: 3, name: category.name, item: absoluteUrl(`/categories/${slug}`) },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-1">
          分类
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {category.name}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          {category.posts.length} 篇文章
        </p>
      </div>

      {category.posts.length === 0 ? (
        <EmptyState compact message="此分类下暂无文章。" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {category.posts.map((post) => (
            <PostCard
              key={post.id}
              title={post.title}
              slug={post.slug}
              excerpt={post.excerpt}
              category={post.category}
              publishedAt={post.publishedAt}
              readingTime={post.readingTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
