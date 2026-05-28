import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = parseInt(searchParams.get("postId") || "0");
  const limit = parseInt(searchParams.get("limit") || "4");

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  let recommendedIds: number[] = [];

  if (userId) {
    const readHistory = await prisma.readHistory.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { readAt: "desc" },
      take: 20,
      include: {
        post: {
          select: {
            categoryId: true,
            tags: { select: { tagId: true } },
          },
        },
      },
    });

    const categoryIds = readHistory
      .map((r) => r.post.categoryId)
      .filter(Boolean) as number[];
    const tagIds = readHistory.flatMap((r) => r.post.tags.map((t) => t.tagId));

    const categoryFreq: Record<number, number> = {};
    const tagFreq: Record<number, number> = {};

    for (const cid of categoryIds) {
      categoryFreq[cid] = (categoryFreq[cid] || 0) + 1;
    }
    for (const tid of tagIds) {
      tagFreq[tid] = (tagFreq[tid] || 0) + 1;
    }

    const topCategories = Object.entries(categoryFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => parseInt(id));

    const topTags = Object.entries(tagFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => parseInt(id));

    if (topCategories.length > 0 || topTags.length > 0) {
      const posts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          id: { not: postId },
          OR: [
            ...(topCategories.length > 0 ? [{ categoryId: { in: topCategories } }] : []),
            ...(topTags.length > 0 ? [{ tags: { some: { tagId: { in: topTags } } } }] : []),
          ],
        },
        select: { id: true },
        take: limit * 2,
        orderBy: { publishedAt: "desc" },
      });

      recommendedIds = posts.map((p) => p.id).slice(0, limit);
    }
  }

  if (recommendedIds.length < limit) {
    const fallback = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        id: { not: postId, notIn: recommendedIds },
      },
      select: { id: true },
      orderBy: { publishedAt: "desc" },
      take: limit - recommendedIds.length,
    });
    recommendedIds.push(...fallback.map((p) => p.id));
  }

  const posts = await prisma.post.findMany({
    where: { id: { in: recommendedIds } },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
      author: { select: { name: true } },
      category: { select: { name: true, slug: true } },
    },
  });

  return NextResponse.json(posts);
}
