import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { parsePagination, paginationMeta } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20 });

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, name: true, username: true, avatar: true } },
          _count: { select: { members: true, posts: true } },
        },
      }),
      prisma.group.count({ where: { isPublic: true } }),
    ]);

    return NextResponse.json(
      {
        groups: groups.map((g) => ({ ...g, memberCount: g._count.members, postCount: g._count.posts })),
        pagination: paginationMeta(page, limit, total),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("[Groups] Failed to fetch groups:", e);
    return NextResponse.json({ error: "获取圈子列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name, description, coverImage, isPublic } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "请输入圈子名称" }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "圈子名称不能超过50个字符" }, { status: 400 });
    }

    const slug = body.slug || slugify(name);

    try {
      const group = await prisma.group.create({
        data: {
          name: name.trim(), slug,
          description: typeof description === "string" ? description.trim().slice(0, 500) || null : null,
          coverImage: typeof coverImage === "string" ? coverImage || null : null,
          isPublic: isPublic !== false,
          ownerId: userId,
          members: { create: { userId, role: "ADMIN" } },
        },
        include: { owner: { select: { id: true, name: true, username: true } } },
      });
      return NextResponse.json(group, { status: 201 });
    } catch (createErr: unknown) {
      if ((createErr as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "该标识已存在" }, { status: 409 });
      }
      throw createErr;
    }
  } catch (e) {
    console.error("[Groups] Failed to create group:", e);
    return NextResponse.json({ error: "创建圈子失败" }, { status: 500 });
  }
}
