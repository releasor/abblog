import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 20;

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
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
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

    const body = await request.json();
    const { name, description, coverImage, isPublic } = body;
    if (!name) return NextResponse.json({ error: "请输入圈子名称" }, { status: 400 });

    const slug = body.slug || slugify(name);
    const existing = await prisma.group.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "该标识已存在" }, { status: 409 });

    const group = await prisma.group.create({
      data: {
        name, slug,
        description: description || null,
        coverImage: coverImage || null,
        isPublic: isPublic !== false,
        ownerId: userId,
        members: { create: { userId, role: "ADMIN" } },
      },
      include: { owner: { select: { id: true, name: true, username: true } } },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (e) {
    console.error("[Groups] Failed to create group:", e);
    return NextResponse.json({ error: "创建圈子失败" }, { status: 500 });
  }
}
