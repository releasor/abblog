import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const commentId = parseInt(id);
  if (isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const { status } = body;

  if (!status || !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be PENDING, APPROVED, or REJECTED" },
      { status: 400 }
    );
  }

  const existing = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { status },
    include: {
      post: { select: { id: true, title: true, slug: true } },
    },
  });

  return NextResponse.json(comment);
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
  const commentId = parseInt(id);
  if (isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  await prisma.comment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}