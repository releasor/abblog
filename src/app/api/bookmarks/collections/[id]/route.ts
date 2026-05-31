import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`bookmark-collection:${userId}`, RATE_LIMITS.api);
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
    const { name, description } = body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "收藏夹名称不能为空" }, { status: 400 });
    }
    if (name !== undefined && name.trim().length > 100) {
      return NextResponse.json({ error: "收藏夹名称不能超过100个字符" }, { status: 400 });
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "描述格式无效" }, { status: 400 });
    }
    if (description && description.length > 500) {
      return NextResponse.json({ error: "描述不能超过500个字符" }, { status: 400 });
    }
    const updated = await prisma.bookmarkCollection.update({
      where: { id: collectionId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim().slice(0, 500) || null }),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[BookmarkCollection] Failed to update collection:", e);
    return NextResponse.json({ error: "更新收藏夹失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    if (collection.isDefault) return NextResponse.json({ error: "不能删除默认收藏夹" }, { status: 400 });

    await prisma.bookmarkCollection.delete({ where: { id: collectionId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[BookmarkCollection] Failed to delete collection:", e);
    return NextResponse.json({ error: "删除收藏夹失败" }, { status: 500 });
  }
}
