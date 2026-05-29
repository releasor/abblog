import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 20;

    const where: Record<string, unknown> = {};
    if (status !== "all" && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[AdminComments] Failed to fetch comments:", e);
    return NextResponse.json({ error: "获取评论列表失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { ids, status } = await request.json();
    if (!ids?.length || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    await prisma.comment.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (e) {
    console.error("[AdminComments] Failed to update comments:", e);
    return NextResponse.json({ error: "更新评论失败" }, { status: 500 });
  }
}
