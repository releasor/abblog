import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collaborators = await prisma.postCollaborator.findMany({
    where: { postId: parseInt(id) },
    include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
  });
  return NextResponse.json(collaborators);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const postId = parseInt(id);
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = post.authorId === parseInt(userId) || post.userId === parseInt(userId);
  if (!isAuthor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: targetUserId, role } = await request.json();
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const collaborator = await prisma.postCollaborator.create({
    data: { postId, userId: parseInt(targetUserId), role: role || "EDITOR" },
    include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
  });
  return NextResponse.json(collaborator, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await prisma.postCollaborator.delete({
    where: { postId_userId: { postId: parseInt(id), userId: parseInt(targetUserId) } },
  });
  return NextResponse.json({ success: true });
}
