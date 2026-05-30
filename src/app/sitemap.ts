import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags, series, groups, topics] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 1000,
    }),
    prisma.category.findMany({
      select: { slug: true },
    }),
    prisma.tag.findMany({
      select: { slug: true },
    }),
    prisma.postSeries.findMany({
      select: { slug: true, updatedAt: true },
    }),
    prisma.group.findMany({
      where: { isPublic: true },
      select: { slug: true, createdAt: true },
    }),
    prisma.topic.findMany({
      select: { slug: true, createdAt: true },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl(""), lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/posts"), lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/categories"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/tags"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/series"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/about"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/links"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/guestbook"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.4 },
    { url: absoluteUrl("/tools"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/groups"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/topics"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/timeline"), lastModified: new Date(), changeFrequency: "daily", priority: 0.5 },
    { url: absoluteUrl("/uses"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/posts/${post.slug}`),
    lastModified: post.updatedAt || post.publishedAt || new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: absoluteUrl(`/categories/${cat.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const tagPages: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: absoluteUrl(`/tags/${tag.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const seriesPages: MetadataRoute.Sitemap = series.map((s) => ({
    url: absoluteUrl(`/series/${s.slug}`),
    lastModified: s.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const groupPages: MetadataRoute.Sitemap = groups.map((g) => ({
    url: absoluteUrl(`/groups/${g.slug}`),
    lastModified: g.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const topicPages: MetadataRoute.Sitemap = topics.map((t) => ({
    url: absoluteUrl(`/topics/${t.slug}`),
    lastModified: t.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...postPages, ...categoryPages, ...tagPages, ...seriesPages, ...groupPages, ...topicPages];
}
