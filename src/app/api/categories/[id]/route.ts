import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_S_MAXAGE, CACHE_STALE_WHILE_REVALIDATE } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let categoryId: number;
    try { categoryId = requireId(id); } catch { return invalidIdResponse(); }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { posts: true } } },
    });

    if (!category) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    return NextResponse.json(category, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_S_MAXAGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}` },
    });
  } catch (e) {
    console.error("[Category] Failed to fetch category:", e);
    return NextResponse.json({ error: "获取分类详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`category-edit:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let categoryId: number;
    try { categoryId = requireId(id); } catch { return invalidIdResponse(); }

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

    const existing = await prisma.category.findUnique({ where: { id: categoryId }, select: { slug: true, name: true } });
    if (!existing) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    if (slug !== existing.slug || trimmedName !== existing.name) {
      const conflict = await prisma.category.findFirst({
        where: {
          id: { not: categoryId },
          OR: [{ name: trimmedName }, { slug }],
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "该分类已存在" },
          { status: 409 }
        );
      }
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: { name: trimmedName, slug },
      include: { _count: { select: { posts: true } } },
    });

    return NextResponse.json(category);
  } catch (e) {
    console.error("[Category] Failed to update category:", e);
    return NextResponse.json({ error: "更新分类失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    let categoryId: number;
    try { categoryId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    // Disassociate posts from this category before deleting
    await prisma.post.updateMany({
      where: { categoryId },
      data: { categoryId: null },
    });

    await prisma.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Category] Failed to delete category:", e);
    return NextResponse.json({ error: "删除分类失败" }, { status: 500 });
  }
}
