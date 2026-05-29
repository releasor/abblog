import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const collections = await prisma.bookmarkCollection.findMany({
      where: { userId },
      include: {
        items: {
          include: { post: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ collections: collections.map((c) => ({ ...c, itemCount: c._count.items })) }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[BookmarkCollections] Failed to fetch collections:", e);
    return NextResponse.json({ error: "获取收藏夹列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { name, description } = await request.json();
    if (!name) return NextResponse.json({ error: "请输入收藏夹名称" }, { status: 400 });

    const existingDefault = await prisma.bookmarkCollection.findFirst({ where: { userId } });

    const collection = await prisma.bookmarkCollection.create({
      data: {
        userId,
        name,
        description: description || null,
        isDefault: !existingDefault,
      },
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (e) {
    console.error("[BookmarkCollections] Failed to create collection:", e);
    return NextResponse.json({ error: "创建收藏夹失败" }, { status: 500 });
  }
}
