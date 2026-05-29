import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const collectionId = parseInt(id);
    if (isNaN(collectionId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== userId)
      return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) return NextResponse.json({ error: "无效文章ID" }, { status: 400 });

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
    const collectionId = parseInt(id);
    if (isNaN(collectionId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) return NextResponse.json({ error: "无效文章ID" }, { status: 400 });

    await prisma.bookmarkItem.delete({
      where: { collectionId_postId: { collectionId, postId: postIdNum } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[BookmarkItems] Failed to remove item from collection:", e);
    return NextResponse.json({ error: "移除收藏失败" }, { status: 500 });
  }
}
