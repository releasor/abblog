import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_MAX_AGE } from "@/lib/constants";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { posts: true } },
      },
    });
    return NextResponse.json(categories, {
      headers: { "Cache-Control": `public, max-age=${CACHE_MAX_AGE}` },
    });
  } catch (e) {
    console.error("[Categories] Failed to fetch categories:", e);
    return NextResponse.json({ error: "获取分类列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`category:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 50) {
      return NextResponse.json(
        { error: "名称需要1-50个字符" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const slug = slugify(trimmedName);

    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: trimmedName }, { slug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "该分类已存在" },
        { status: 409 }
      );
    }

    try {
      const category = await prisma.category.create({
        data: { name: trimmedName, slug },
        include: { _count: { select: { posts: true } } },
      });
      return NextResponse.json(category, { status: 201 });
    } catch (createErr: unknown) {
      if ((createErr as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "该分类已存在" }, { status: 409 });
      }
      throw createErr;
    }
  } catch (e) {
    console.error("[Categories] Failed to create category:", e);
    return NextResponse.json({ error: "创建分类失败" }, { status: 500 });
  }
}
