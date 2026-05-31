import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { absoluteUrl } from "@/lib/site-url";
import { getRelatedPosts } from "@/lib/related-posts";
import { injectHeadingIds, extractHeadings, countWords } from "@/lib/toc";
import { PostContent } from "./post-content";
import { CommentSection } from "@/components/comment-section";
import { RelatedPosts } from "@/components/related-posts";
import { TableOfContents } from "@/components/table-of-contents";
import { ReadingProgress } from "@/components/reading-progress";
import { ShareButtons } from "@/components/share-buttons";
import { PostActions } from "@/components/post-actions";
import { ReadingTracker } from "@/components/reading-tracker";
import { RecommendedPosts } from "@/components/recommended-posts";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";

const AiSummary = dynamic(() => import("@/components/ai-summary").then((m) => m.AiSummary));
const AiChat = dynamic(() => import("@/components/ai-chat").then((m) => m.AiChat));
const DonateButton = dynamic(() => import("@/components/donate-button").then((m) => m.DonateButton));
const SEOPanel = dynamic(() => import("@/components/seo-panel").then((m) => m.SEOPanel));
const ExportButton = dynamic(() => import("@/components/export-button").then((m) => m.ExportButton));

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      slug: true,
      author: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  if (!post) return {};

  const description = post.excerpt || `阅读 ${post.title} — billionaire`;
  const url = absoluteUrl(`/posts/${post.slug}`);

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: [post.author.name],
      tags: post.tags.map((pt) => pt.tag.name),
      images: post.coverImageUrl ? [{ url: post.coverImageUrl, alt: post.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
    },
  };
}

export default async function PublicPostPage({ params }: PageProps) {
  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      author: { select: { id: true, name: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") {
    notFound();
  }

  const readingTime = estimateReadingTime(post.content);
  const wordCount = countWords(post.content);
  const processedContent = injectHeadingIds(post.content);
  const headings = extractHeadings(processedContent);
  const showToc = wordCount >= 1500 && headings.length > 0;

  const [relatedPosts, session] = await Promise.all([
    getRelatedPosts(post.id),
    getServerSession(authOptions),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImageUrl || undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/posts/${post.slug}`),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("") },
      ...(post.category ? [{ "@type": "ListItem", position: 2, name: post.category.name, item: absoluteUrl(`/categories/${post.category.slug}`) }] : []),
      { "@type": "ListItem", position: post.category ? 3 : 2, name: post.title, item: absoluteUrl(`/posts/${post.slug}`) },
    ],
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <ReadingProgress />
      <ReadingTracker postId={post.id} />
      <div className="flex md:gap-8">
      <article className="max-w-3xl flex-1 min-w-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {post.coverImageUrl && (
        <div className="relative w-full aspect-[16/9] mb-8 rounded-lg overflow-hidden">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
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
          <span>{readingTime} 分钟阅读</span>
          {post.category && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">
                {post.category.name}
              </span>
            </>
          )}
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>作者：{post.author.name}</span>
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

      <AiSummary postId={post.id} />

      <PostContent content={processedContent} />

      <div className="flex flex-wrap items-center justify-between gap-4 py-6 my-8 border-t border-b border-zinc-200 dark:border-zinc-800">
        <PostActions postId={post.id} />
        <div className="flex items-center gap-2">
          <DonateButton recipientId={post.author.id} recipientName={post.author.name} postId={post.id} />
          <ExportButton postId={post.id} title={post.title} />
          <ShareButtons title={post.title} url={absoluteUrl(`/posts/${post.slug}`)} postId={post.id} />
        </div>
      </div>

      <CommentSection postId={post.id} />

      <RelatedPosts posts={relatedPosts} />
      <RecommendedPosts postId={post.id} />
    </article>
    {showToc && <TableOfContents headings={headings} />}
    {session?.user?.role === "admin" && (
      <div className="hidden xl:block w-72 flex-shrink-0">
        <div className="sticky top-24">
          <SEOPanel postId={post.id} />
        </div>
      </div>
    )}
      </div>
      <AiChat postId={post.id} />
    </div>
  );
}
