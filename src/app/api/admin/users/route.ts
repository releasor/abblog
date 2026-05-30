import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20 });
    const q = searchParams.get("q") || "";

    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { username: { contains: q } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          points: true,
          level: true,
          createdAt: true,
          _count: { select: { posts: true, comments: true, likes: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: paginationMeta(page, limit, total),
    }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[AdminUsers] Failed to fetch users:", e);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let userId: string, action: string, value: string;
    try {
      const body = await request.json();
      userId = body.userId;
      action = body.action;
      value = body.value;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!userId || !action) return NextResponse.json({ error: "参数无效" }, { status: 400 });
    let userIdNum: number;
    try { userIdNum = requireId(userId); } catch { return invalidIdResponse(); }

    switch (action) {
      case "setRole":
        if (!["USER", "EDITOR", "ADMIN"].includes(value)) {
          return NextResponse.json({ error: "无效角色" }, { status: 400 });
        }
        await prisma.user.update({ where: { id: userIdNum }, data: { role: value as "USER" | "EDITOR" | "ADMIN" } });
        break;
      case "addPoints":
        await prisma.user.update({
          where: { id: userIdNum },
          data: { points: { increment: parseInt(value) || 0 } },
        });
        break;
      default:
        return NextResponse.json({ error: "未知操作" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[AdminUsers] Failed to update user:", e);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}
