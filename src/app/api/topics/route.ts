import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PUBLIC_S_MAXAGE_MEDIUM, CACHE_PUBLIC_STALE_MEDIUM } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") || "hot";
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20 });

    const orderBy = sort === "new" ? { createdAt: "desc" as const } : { postCount: "desc" as const };

    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        orderBy,
        skip,
        take: limit,
      }),
      prisma.topic.count(),
    ]);

    return NextResponse.json({
      topics,
      pagination: paginationMeta(page, limit, total),
    }, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_MEDIUM}, stale-while-revalidate=${CACHE_PUBLIC_STALE_MEDIUM}` },
    });
  } catch (e) {
    console.error("[Topics] Failed to fetch topics:", e);
    return NextResponse.json({ error: "获取话题列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId || !isAdmin(session)) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const rl = checkRateLimit(`topic:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let name: string, description: string | undefined, coverImage: string | undefined;
    try {
      const body = await request.json();
      name = body.name;
      description = body.description;
      coverImage = body.coverImage;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "请输入话题名称" }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "话题名称不能超过50个字符" }, { status: 400 });
    }

    const slug = slugify(name);

    try {
      const topic = await prisma.topic.create({
        data: { name: name.trim(), slug, description: typeof description === "string" ? description.trim().slice(0, 500) || null : null, coverImage: typeof coverImage === "string" ? coverImage || null : null },
      });
      return NextResponse.json(topic, { status: 201 });
    } catch (createErr: unknown) {
      if ((createErr as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "该话题已存在" }, { status: 409 });
      }
      throw createErr;
    }
  } catch (e) {
    console.error("[Topics] Failed to create topic:", e);
    return NextResponse.json({ error: "创建话题失败" }, { status: 500 });
  }
}
