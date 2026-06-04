import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CACHE_PUBLIC_S_MAXAGE_SHORT, CACHE_PUBLIC_STALE_SHORT, ADMIN_PAGE_SIZE } from "@/lib/constants";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const topic = await prisma.topic.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverImage: true,
        postCount: true,
        posts: {
          take: ADMIN_PAGE_SIZE,
          orderBy: { createdAt: "desc" },
          select: {
            post: {
              select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true },
            },
          },
        },
      },
    });

    if (!topic) return NextResponse.json({ error: "话题不存在" }, { status: 404 });

    return NextResponse.json(
      {
        ...topic,
        posts: topic.posts.map((tp) => tp.post),
      },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_SHORT}, stale-while-revalidate=${CACHE_PUBLIC_STALE_SHORT}` } }
    );
  } catch (e) {
    console.error("[Topic] Failed to fetch topic:", e);
    return NextResponse.json({ error: "获取话题详情失败" }, { status: 500 });
  }
}
