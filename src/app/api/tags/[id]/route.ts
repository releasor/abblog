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
  const tagId = parseInt(id);
  if (isNaN(tagId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: { _count: { select: { posts: true } } },
  });

  if (!tag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(tag);
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
  const tagId = parseInt(id);
  if (isNaN(tagId)) {
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

  const existing = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (slug !== existing.slug || trimmedName !== existing.name) {
    const conflict = await prisma.tag.findFirst({
      where: {
        id: { not: tagId },
        OR: [{ name: trimmedName }, { slug }],
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Tag already exists" },
        { status: 409 }
      );
    }
  }

  const tag = await prisma.tag.update({
    where: { id: tagId },
    data: { name: trimmedName, slug },
    include: { _count: { select: { posts: true } } },
  });

  return NextResponse.json(tag);
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
  const tagId = parseInt(id);
  if (isNaN(tagId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // PostTag entries will be cascade-deleted when the tag is deleted
  await prisma.tag.delete({ where: { id: tagId } });

  return NextResponse.json({ success: true });
}
