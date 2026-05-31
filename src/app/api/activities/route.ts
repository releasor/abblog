import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePagination, paginationMeta } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20 });
    const userId = searchParams.get("userId");

    const userIdNum = userId ? parseInt(userId) : NaN;
    const where = !isNaN(userIdNum) ? { userId: userIdNum } : {};

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({
      activities,
      pagination: paginationMeta(page, limit, total),
    }, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (e) {
    console.error("[Activities] Failed to list activities:", e);
    return NextResponse.json({ error: "获取动态列表失败" }, { status: 500 });
  }
}
