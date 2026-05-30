import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePagination, paginationMeta } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20 });

    const where: Record<string, unknown> = {};
    if (status !== "all" && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          post: { select: { id: true, title: true, slug: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return NextResponse.json({
      comments,
      pagination: paginationMeta(page, limit, total),
    }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[AdminComments] Failed to fetch comments:", e);
    return NextResponse.json({ error: "获取评论列表失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let ids: string[], status: string;
    try {
      const body = await request.json();
      ids = body.ids;
      status = body.status;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0 || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const validIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (validIds.length === 0) {
      return NextResponse.json({ error: "无效的评论ID" }, { status: 400 });
    }

    await prisma.comment.updateMany({
      where: { id: { in: validIds } },
      data: { status: status as "APPROVED" | "REJECTED" },
    });

    return NextResponse.json({ success: true, updated: validIds.length });
  } catch (e) {
    console.error("[AdminComments] Failed to update comments:", e);
    return NextResponse.json({ error: "更新评论失败" }, { status: 500 });
  }
}
