import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`series-post:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let seriesId: number;
    try { seriesId = requireId(id); } catch { return invalidIdResponse(); }

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId }, select: { userId: true } });
    if (!series || series.userId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let postId: string;
    try {
      const body = await request.json();
      postId = body.postId;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    let postIdNum: number;
    try { postIdNum = requireId(postId); } catch { return invalidIdResponse(); }

    const maxOrder = await prisma.seriesPost.findFirst({
      where: { seriesId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    try {
      const sp = await prisma.seriesPost.create({
        data: { seriesId, postId: postIdNum, order: (maxOrder?.order ?? -1) + 1 },
      });
      return NextResponse.json(sp, { status: 201 });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "该文章已在系列中" }, { status: 409 });
      }
      throw e;
    }
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
    let seriesId: number;
    try { seriesId = requireId(id); } catch { return invalidIdResponse(); }

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId }, select: { userId: true } });
    if (!series || series.userId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { order: newOrder } = body;
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
