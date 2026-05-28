import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { createActivity } from "@/lib/activity";
import { addPoints, POINTS } from "@/lib/points";

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
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImageUrl, categoryId, tags, status, isPinned, scheduledAt } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const slug = body.slug || slugify(title);
  const existing = await prisma.post.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
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
      authorId: parseInt(userId),
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
    await createActivity(parseInt(userId), "POST_PUBLISHED", post.id, { title: post.title });
    await addPoints(parseInt(userId), POINTS.POST_PUBLISHED);
  }

  return NextResponse.json(post, { status: 201 });
}
