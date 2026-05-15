import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: true } },
    },
  });
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 50) {
    return NextResponse.json(
      { error: "Name must be between 1 and 50 characters" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();
  const slug = slugify(trimmedName);

  const existing = await prisma.tag.findFirst({
    where: {
      OR: [{ name: trimmedName }, { slug }],
    },
  });

  if (existing) {
    return NextResponse.json(existing);
  }

  const tag = await prisma.tag.create({
    data: { name: trimmedName, slug },
    include: { _count: { select: { posts: true } } },
  });

  return NextResponse.json(tag, { status: 201 });
}
