import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const updated = await prisma.bookmarkCollection.update({
      where: { id: collectionId },
      data: { name: body.name ?? undefined, description: body.description ?? undefined },
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
    const collectionId = parseInt(id);
    if (isNaN(collectionId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

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
