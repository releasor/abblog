import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "无效ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ isBookmarked: false });
    }

    const existing = await prisma.bookmarkItem.findFirst({
      where: {
        postId,
        collection: { userId },
      },
    });

    return NextResponse.json({ isBookmarked: !!existing }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[Bookmark] Failed to fetch bookmark status:", e);
    return NextResponse.json({ error: "获取收藏状态失败" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "无效ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // Check if already bookmarked in any collection
    const existing = await prisma.bookmarkItem.findFirst({
      where: {
        postId,
        collection: { userId },
      },
    });

    if (existing) {
      // Remove from all collections
      await prisma.bookmarkItem.deleteMany({
        where: {
          postId,
          collection: { userId },
        },
      });
      return NextResponse.json({ isBookmarked: false });
    } else {
      // Get or create default collection
      let defaultCollection = await prisma.bookmarkCollection.findFirst({
        where: { userId, isDefault: true },
      });

      if (!defaultCollection) {
        defaultCollection = await prisma.bookmarkCollection.create({
          data: { userId, name: "默认收藏夹", isDefault: true },
        });
      }

      await prisma.bookmarkItem.create({
        data: { collectionId: defaultCollection.id, postId },
      });

      await createActivity(userId, "BOOKMARK_ADDED", postId);

      return NextResponse.json({ isBookmarked: true });
    }
  } catch (e) {
    console.error("[Bookmark] Failed to toggle bookmark:", e);
    return NextResponse.json({ error: "收藏操作失败" }, { status: 500 });
  }
}
