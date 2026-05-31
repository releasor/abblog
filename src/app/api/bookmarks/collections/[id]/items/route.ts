import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`bookmark-item:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let collectionId: number;
    try { collectionId = requireId(id); } catch { return invalidIdResponse(); }

    const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== userId)
      return NextResponse.json({ error: "无权限" }, { status: 403 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { postId } = body;
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    let postIdNum: number;
    try { postIdNum = requireId(postId); } catch { return invalidIdResponse(); }

    const item = await prisma.bookmarkItem.create({
      data: { collectionId, postId: postIdNum },
    });

    await createActivity(userId, "BOOKMARK_ADDED", postIdNum);
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    console.error("[BookmarkItems] Failed to add item to collection:", e);
    return NextResponse.json({ error: "添加收藏失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let collectionId: number;
    try { collectionId = requireId(id); } catch { return invalidIdResponse(); }

    const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== userId)
      return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    let postIdNum: number;
    try { postIdNum = requireId(postId); } catch { return invalidIdResponse(); }

    await prisma.bookmarkItem.delete({
      where: { collectionId_postId: { collectionId, postId: postIdNum } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[BookmarkItems] Failed to remove item from collection:", e);
    return NextResponse.json({ error: "移除收藏失败" }, { status: 500 });
  }
}
