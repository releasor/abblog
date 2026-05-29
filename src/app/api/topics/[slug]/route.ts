import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const topic = await prisma.topic.findUnique({
      where: { slug },
      include: {
        posts: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
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
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("[Topic] Failed to fetch topic:", e);
    return NextResponse.json({ error: "获取话题详情失败" }, { status: 500 });
  }
}
