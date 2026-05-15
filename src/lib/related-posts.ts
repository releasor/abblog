import { prisma } from "./prisma";

interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
  score: number;
}

export async function getRelatedPosts(
  currentPostId: number,
  limit = 3
): Promise<RelatedPost[]> {
  const currentPost = await prisma.post.findUnique({
    where: { id: currentPostId },
    select: {
      categoryId: true,
      tags: { select: { tagId: true } },
    },
  });

  if (!currentPost) return [];

  const currentTagIds = currentPost.tags.map((pt) => pt.tagId);

  // Phase 1: find posts sharing tags, scored by shared tag count
  let relatedByTag: RelatedPost[] = [];

  if (currentTagIds.length > 0) {
    const postsWithSharedTags = await prisma.post.findMany({
      where: {
        id: { not: currentPostId },
        status: "PUBLISHED",
        tags: { some: { tagId: { in: currentTagIds } } },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImageUrl: true,
        publishedAt: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { tagId: true } },
      },
    });

    relatedByTag = postsWithSharedTags
      .map((post) => {
        const sharedCount = post.tags.filter((pt) =>
          currentTagIds.includes(pt.tagId)
        ).length;
        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          coverImageUrl: post.coverImageUrl,
          publishedAt: post.publishedAt,
          category: post.category,
          score: sharedCount,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aDate = a.publishedAt?.getTime() ?? 0;
        const bDate = b.publishedAt?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(0, limit);
  }

  // Phase 2: fill remaining with same-category posts if needed
  if (relatedByTag.length < limit && currentPost.categoryId != null) {
    const remaining = limit - relatedByTag.length;
    const excludeIds = [currentPostId, ...relatedByTag.map((p) => p.id)];

    const categoryPosts = await prisma.post.findMany({
      where: {
        id: { notIn: excludeIds },
        status: "PUBLISHED",
        categoryId: currentPost.categoryId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImageUrl: true,
        publishedAt: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { tagId: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: remaining,
    });

    const categoryRelated = categoryPosts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      publishedAt: post.publishedAt,
      category: post.category,
      score: 0,
    }));

    relatedByTag = [...relatedByTag, ...categoryRelated];
  }

  return relatedByTag;
}
