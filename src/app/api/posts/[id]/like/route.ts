import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  const likeCount = await prisma.like.count({ where: { postId } });
  let isLiked = false;

  if (userId) {
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId: parseInt(userId) } },
    });
    isLiked = !!existing;
  }

  return NextResponse.json({ count: likeCount, isLiked });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const uid = parseInt(userId);

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: uid } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    const count = await prisma.like.count({ where: { postId } });
    return NextResponse.json({ isLiked: false, count });
  } else {
    await prisma.like.create({ data: { postId, userId: uid } });
    const count = await prisma.like.count({ where: { postId } });
    await createActivity(uid, "LIKE_ADDED", postId);
    return NextResponse.json({ isLiked: true, count });
  }
}
