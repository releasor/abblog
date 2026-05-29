import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const seriesId = parseInt(id);
    if (isNaN(seriesId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
    if (!series || series.userId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) return NextResponse.json({ error: "无效文章ID" }, { status: 400 });

    const maxOrder = await prisma.seriesPost.findFirst({
      where: { seriesId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const sp = await prisma.seriesPost.create({
      data: { seriesId, postId: postIdNum, order: (maxOrder?.order ?? -1) + 1 },
    });
    return NextResponse.json(sp, { status: 201 });
  } catch (e) {
    console.error("[SeriesPosts] Failed to add post to series:", e);
    return NextResponse.json({ error: "添加文章到系列失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const seriesId = parseInt(id);
    if (isNaN(seriesId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
    if (!series || series.userId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { order: newOrder } = await request.json();
    if (!Array.isArray(newOrder)) return NextResponse.json({ error: "请提供排序数组" }, { status: 400 });

    await prisma.$transaction(
      newOrder.map((postId: number, index: number) =>
        prisma.seriesPost.update({
          where: { seriesId_postId: { seriesId, postId } },
          data: { order: index },
        })
      )
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[SeriesPosts] Failed to reorder series posts:", e);
    return NextResponse.json({ error: "重新排序失败" }, { status: 500 });
  }
}
