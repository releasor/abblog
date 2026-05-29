import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") || "hot";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 20;

    const orderBy = sort === "new" ? { createdAt: "desc" as const } : { postCount: "desc" as const };

    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.topic.count(),
    ]);

    return NextResponse.json({
      topics,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, {
      headers: { "Cache-Control": "public, max-age=300" },
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
    const role = (session?.user as { role?: string })?.role;
    if (!userId || role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { name, description, coverImage } = await request.json();
    if (!name) return NextResponse.json({ error: "请输入话题名称" }, { status: 400 });

    const slug = slugify(name);
    const existing = await prisma.topic.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "该话题已存在" }, { status: 409 });

    const topic = await prisma.topic.create({
      data: { name, slug, description, coverImage },
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (e) {
    console.error("[Topics] Failed to create topic:", e);
    return NextResponse.json({ error: "创建话题失败" }, { status: 500 });
  }
}
