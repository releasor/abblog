import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collectionId = parseInt(id);
  if (isNaN(collectionId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
  if (!collection || collection.userId !== parseInt(userId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
  const postIdNum = parseInt(postId);
  if (isNaN(postIdNum)) return NextResponse.json({ error: "Invalid postId" }, { status: 400 });

  const item = await prisma.bookmarkItem.create({
    data: { collectionId, postId: postIdNum },
  });

  await createActivity(parseInt(userId), "BOOKMARK_ADDED", postIdNum);
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collectionId = parseInt(id);
  if (isNaN(collectionId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
  const postIdNum = parseInt(postId);
  if (isNaN(postIdNum)) return NextResponse.json({ error: "Invalid postId" }, { status: 400 });

  await prisma.bookmarkItem.delete({
    where: { collectionId_postId: { collectionId, postId: postIdNum } },
  });
  return NextResponse.json({ success: true });
}
