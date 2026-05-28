import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id: parseInt(id) },
    include: {
      owner: { select: { id: true, name: true, username: true, avatar: true } },
      members: { include: { user: { select: { id: true, name: true, username: true, avatar: true } } } },
      _count: { select: { members: true, posts: true } },
    },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...group, memberCount: group._count.members, postCount: group._count.posts });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id: parseInt(id) } });
  if (!group || group.ownerId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updated = await prisma.group.update({
    where: { id: parseInt(id) },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      coverImage: body.coverImage ?? undefined,
      isPublic: body.isPublic ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id: parseInt(id) } });
  if (!group || group.ownerId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.group.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
