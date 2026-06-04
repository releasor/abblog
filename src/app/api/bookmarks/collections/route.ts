import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { ADMIN_PAGE_SIZE, CACHE_PRIVATE_MAX_AGE, CACHE_PRIVATE_STALE } from "@/lib/constants";

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
          take: ADMIN_PAGE_SIZE,
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ collections: collections.map((c) => ({ ...c, itemCount: c._count.items })) }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE}, stale-while-revalidate=${CACHE_PRIVATE_STALE}` } });
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

    const rl = checkRateLimit(`bookmark-collection:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let name: string, description: string | undefined;
    try {
      const body = await request.json();
      name = body.name;
      description = body.description;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "请输入收藏夹名称" }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "收藏夹名称不能超过50个字符" }, { status: 400 });
    }

    const collection = await prisma.$transaction(async (tx) => {
      const existingDefault = await tx.bookmarkCollection.findFirst({ where: { userId } });
      return tx.bookmarkCollection.create({
        data: {
          userId,
          name: name.trim(),
          description: typeof description === "string" ? description.trim().slice(0, 200) || null : null,
          isDefault: !existingDefault,
        },
      });
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (e) {
    console.error("[BookmarkCollections] Failed to create collection:", e);
    return NextResponse.json({ error: "创建收藏夹失败" }, { status: 500 });
  }
}
