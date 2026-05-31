import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let seriesId: number;
    try { seriesId = requireId(id); } catch { return invalidIdResponse(); }

    const series = await prisma.postSeries.findUnique({
      where: { id: seriesId },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
        posts: {
          include: { post: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, coverImageUrl: true } } },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!series) return NextResponse.json({ error: "系列不存在" }, { status: 404 });
    return NextResponse.json(
      { ...series, posts: series.posts.map((sp) => ({ ...sp.post, order: sp.order })) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("[Series] Failed to fetch series:", e);
    return NextResponse.json({ error: "获取系列详情失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`series-edit:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let seriesId: number;
    try { seriesId = requireId(id); } catch { return invalidIdResponse(); }

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId }, select: { userId: true } });
    if (!series) return NextResponse.json({ error: "系列不存在" }, { status: 404 });
    if (series.userId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name, description, coverImage } = body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "系列名称不能为空" }, { status: 400 });
    }
    if (name !== undefined && name.trim().length > 100) {
      return NextResponse.json({ error: "系列名称不能超过100个字符" }, { status: 400 });
    }
    const updated = await prisma.postSeries.update({
      where: { id: seriesId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim().slice(0, 500) || null }),
        ...(coverImage !== undefined && { coverImage: coverImage || null }),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[Series] Failed to update series:", e);
    return NextResponse.json({ error: "更新系列失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let seriesId: number;
    try { seriesId = requireId(id); } catch { return invalidIdResponse(); }

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId }, select: { userId: true } });
    if (!series) return NextResponse.json({ error: "系列不存在" }, { status: 404 });
    if (series.userId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    await prisma.postSeries.delete({ where: { id: seriesId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Series] Failed to delete series:", e);
    return NextResponse.json({ error: "删除系列失败" }, { status: 500 });
  }
}
