import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { DailyQuote } from "@/components/daily-quote";
import { ActivityItem } from "@/components/activity-item";
import { Pin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [pinnedPosts, posts, activities] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED", isPinned: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: {
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED", isPinned: false },
      orderBy: { publishedAt: "desc" },
      take: 9,
      include: {
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
      },
    }),
  ]);

  const featured = posts.slice(0, 3);
  const remaining = posts.slice(3);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("zh-CN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      {/* Hero - MiMo 3D flip card with text pattern reveal */}
      <HeroSection />

      {/* Pinned Posts */}
      {pinnedPosts.length > 0 && (
        <section className="showcase-section">
          <h2 className="showcase-title flex items-center gap-2">
            <Pin className="w-5 h-5 text-indigo-500" />
            置顶文章
          </h2>
          <div className="showcase-grid">
            {pinnedPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="showcase-card"
              >
                <div className="showcase-card-overlay">
                  <h3 className="showcase-card-title">{post.title}</h3>
                  {post.excerpt && (
                    <p className="showcase-card-desc">{post.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Showcase - Featured posts as horizontal image cards */}
      {featured.length > 0 && (
        <section className="showcase-section">
          <h2 className="showcase-title">精选文章</h2>
          <div className="showcase-grid">
            {featured.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="showcase-card"
              >
                <div className="showcase-card-overlay">
                  <h3 className="showcase-card-title">{post.title}</h3>
                  {post.excerpt && (
                    <p className="showcase-card-desc">{post.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Blog - MiMo numbered list */}
      <section className="blog-section">
        <h2 className="blog-section-title">最新文章</h2>

        {(remaining.length === 0 && featured.length === 0) ? (
          <p className="text-zinc-500 dark:text-zinc-500 text-center py-12">
            暂无文章，请稍后再来！
          </p>
        ) : (
          <div className="blog-list">
            {(remaining.length > 0 ? remaining : featured).map((post, index) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="blog-row group"
              >
                <span className="blog-row-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="blog-row-content">
                  <h3 className="blog-row-title">{post.title}</h3>
                  {post.excerpt && (
                    <p className="blog-row-desc">{post.excerpt}</p>
                  )}
                </div>
                <div className="blog-row-meta">
                  {post.category && (
                    <span className="blog-row-category">{post.category.name}</span>
                  )}
                  {post.publishedAt && (
                    <time className="blog-row-date" dateTime={post.publishedAt.toISOString()}>
                      {formatDate(post.publishedAt)}
                    </time>
                  )}
                  <span className="blog-row-reading">{estimateReadingTime(post.content)} min</span>
                </div>
                <span className="blog-row-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activities */}
      {activities.length > 0 && (
        <section className="container mx-auto px-4 py-12 max-w-4xl">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">最新动态</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {activities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={{
                    ...activity,
                    createdAt: activity.createdAt.toISOString(),
                  }}
                />
              ))}
            </div>
            <Link
              href="/timeline"
              className="block mt-4 text-center text-sm text-indigo-500 hover:text-indigo-600"
            >
              查看更多动态 →
            </Link>
          </div>
        </section>
      )}

      {/* Daily Quote */}
      <DailyQuote />
    </div>
  );
}
