import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { createActivity } from "@/lib/activity";
import { addPoints, POINTS } from "@/lib/points";
import { estimateReadingTime } from "@/lib/reading-time";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const status = searchParams.get("status");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" as const : "desc" as const;

  const where: Record<string, unknown> = {};
  if (status === "DRAFT" || status === "PUBLISHED") {
    where.status = status;
  }

  const orderBy: Record<string, string>[] = [];
  if (sortBy === "publishedAt" || sortBy === "createdAt" || sortBy === "title") {
    orderBy.push({ isPinned: "desc" });
    orderBy.push({ [sortBy]: sortOrder });
  } else {
    orderBy.push({ isPinned: "desc" });
    orderBy.push({ createdAt: "desc" });
  }

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { name: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
          _count: { select: { comments: { where: { status: "PENDING" } } } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({
      posts: posts.map((p) => ({
        ...p,
        tags: p.tags.map((pt) => pt.tag),
        pendingComments: p._count.comments,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    console.error("[Posts] Failed to list posts:", e);
    return NextResponse.json({ error: "获取文章列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImageUrl, categoryId, tags, status, isPinned, scheduledAt } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
  }
  if (typeof title !== "string" || title.length > 200) {
    return NextResponse.json({ error: "标题不能超过200个字符" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length > 500000) {
    return NextResponse.json({ error: "内容过长" }, { status: 400 });
  }

  try {
    const slug = body.slug || slugify(title);
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "该标识已被其他文章使用" }, { status: 409 });
    }

    const isPublished = status === "PUBLISHED";

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        coverImageUrl: coverImageUrl || null,
        status: isPublished ? "PUBLISHED" : "DRAFT",
        publishedAt: isPublished ? new Date() : null,
        isPinned: isPinned ? Boolean(isPinned) : false,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        readingTime: estimateReadingTime(content),
        authorId: userId,
        categoryId: categoryId ? parseInt(categoryId) : null,
        tags: tags?.length
          ? {
              create: tags.map((tagId: string) => ({
                tag: { connect: { id: parseInt(tagId) } },
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    if (isPublished) {
      await Promise.all([
        createActivity(userId, "POST_PUBLISHED", post.id, { title: post.title }),
        addPoints(userId, POINTS.POST_PUBLISHED),
      ]);
    }

    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    console.error("[Posts] Failed to create post:", e);
    return NextResponse.json({ error: "创建文章失败" }, { status: 500 });
  }
}
