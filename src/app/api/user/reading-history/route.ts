import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 20;

    const [history, total] = await Promise.all([
      prisma.readHistory.findMany({
        where: { userId },
        orderBy: { readAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          post: {
            select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, category: { select: { name: true } } },
          },
        },
      }),
      prisma.readHistory.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      items: history,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[ReadingHistory] Failed to fetch reading history:", e);
    return NextResponse.json({ error: "获取阅读历史失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (postId) {
      await prisma.readHistory.deleteMany({ where: { userId, postId: parseInt(postId) } });
    } else {
      await prisma.readHistory.deleteMany({ where: { userId } });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[ReadingHistory] Failed to delete reading history:", e);
    return NextResponse.json({ error: "删除阅读历史失败" }, { status: 500 });
  }
}
