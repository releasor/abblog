import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET(request: NextRequest) {
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
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description, coverImage } = await request.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const slug = slugify(name);
  const existing = await prisma.topic.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Topic exists" }, { status: 409 });

  const topic = await prisma.topic.create({
    data: { name, slug, description, coverImage },
  });

  return NextResponse.json(topic, { status: 201 });
}
