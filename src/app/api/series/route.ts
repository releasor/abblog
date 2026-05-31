import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20 });
    const mine = searchParams.get("mine") === "true";

    let userId: number | undefined;
    if (mine) {
      const session = await getServerSession(authOptions);
      userId = getAuthUserId(session) ?? undefined;
      if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const where = userId ? { userId } : {};

    const [series, total] = await Promise.all([
      prisma.postSeries.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, username: true, avatar: true } },
          posts: {
            include: { post: { select: { id: true, title: true, slug: true, publishedAt: true } } },
            orderBy: { order: "asc" },
          },
          _count: { select: { posts: true } },
        },
      }),
      prisma.postSeries.count({ where }),
    ]);

    return NextResponse.json(
      {
        series: series.map((s) => ({
          ...s,
          posts: s.posts.map((sp) => ({ ...sp.post, order: sp.order })),
          postCount: s._count.posts,
        })),
        pagination: paginationMeta(page, limit, total),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("[Series] Failed to fetch series:", e);
    return NextResponse.json({ error: "获取系列列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`series:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name, description, coverImage } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "请输入系列名称" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "系列名称不能超过100个字符" }, { status: 400 });
    }

    const slug = body.slug || slugify(name);

    try {
      const series = await prisma.postSeries.create({
        data: {
          name: name.trim(), slug,
          description: typeof description === "string" ? description.trim().slice(0, 500) || null : null,
          coverImage: typeof coverImage === "string" ? coverImage || null : null,
          userId,
        },
        include: { user: { select: { id: true, name: true, username: true } } },
      });
      return NextResponse.json(series, { status: 201 });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "该标识已存在" }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    console.error("[Series] Failed to create series:", e);
    return NextResponse.json({ error: "创建系列失败" }, { status: 500 });
  }
}
