import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const [series, total] = await Promise.all([
    prisma.postSeries.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
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
    prisma.postSeries.count(),
  ]);

  return NextResponse.json({
    series: series.map((s) => ({
      ...s,
      posts: s.posts.map((sp) => ({ ...sp.post, order: sp.order })),
      postCount: s._count.posts,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, description, coverImage } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const slug = body.slug || slugify(name);
  const existing = await prisma.postSeries.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

  const series = await prisma.postSeries.create({
    data: { name, slug, description: description || null, coverImage: coverImage || null, userId: parseInt(userId) },
    include: { user: { select: { id: true, name: true, username: true } } },
  });

  return NextResponse.json(series, { status: 201 });
}
