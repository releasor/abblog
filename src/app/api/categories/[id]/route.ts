import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { posts: true } } },
  });

  if (!category) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(category, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
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

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (slug !== existing.slug || trimmedName !== existing.name) {
    const conflict = await prisma.category.findFirst({
      where: {
        id: { not: categoryId },
        OR: [{ name: trimmedName }, { slug }],
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Category already exists" },
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
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Disassociate posts from this category before deleting
  await prisma.post.updateMany({
    where: { categoryId },
    data: { categoryId: null },
  });

  await prisma.category.delete({ where: { id: categoryId } });

  return NextResponse.json({ success: true });
}
