import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { value } = await request.json();

  if (value !== 1 && value !== -1) {
    return NextResponse.json({ error: "Value must be 1 or -1" }, { status: 400 });
  }

  const uid = parseInt(userId);

  const existing = await prisma.postVote.findUnique({
    where: { postId_userId: { postId, userId: uid } },
  });

  let vote;
  let scoreDelta = 0;

  if (existing) {
    if (existing.value === value) {
      await prisma.postVote.delete({ where: { id: existing.id } });
      scoreDelta = -value;
      vote = null;
    } else {
      vote = await prisma.postVote.update({
        where: { id: existing.id },
        data: { value },
      });
      scoreDelta = value * 2;
    }
  } else {
    vote = await prisma.postVote.create({
      data: { postId, userId: uid, value },
    });
    scoreDelta = value;
    if (value === 1) {
      await createActivity(uid, "LIKE_ADDED", postId);
    }
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data: { score: { increment: scoreDelta } },
    select: { score: true },
  });

  return NextResponse.json({ vote, score: post.score });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const uid = parseInt(userId);

  const existing = await prisma.postVote.findUnique({
    where: { postId_userId: { postId, userId: uid } },
  });

  if (!existing) return NextResponse.json({ error: "No vote found" }, { status: 404 });

  await prisma.postVote.delete({ where: { id: existing.id } });
  await prisma.post.update({
    where: { id: postId },
    data: { score: { decrement: existing.value } },
  });

  return NextResponse.json({ success: true });
}
