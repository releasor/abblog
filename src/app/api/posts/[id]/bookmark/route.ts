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

  if (!userId) {
    return NextResponse.json({ isBookmarked: false });
  }

  const existing = await prisma.bookmarkItem.findFirst({
    where: {
      postId,
      collection: { userId: parseInt(userId) },
    },
  });

  return NextResponse.json({ isBookmarked: !!existing });
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

  // Check if already bookmarked in any collection
  const existing = await prisma.bookmarkItem.findFirst({
    where: {
      postId,
      collection: { userId: uid },
    },
  });

  if (existing) {
    // Remove from all collections
    await prisma.bookmarkItem.deleteMany({
      where: {
        postId,
        collection: { userId: uid },
      },
    });
    return NextResponse.json({ isBookmarked: false });
  } else {
    // Get or create default collection
    let defaultCollection = await prisma.bookmarkCollection.findFirst({
      where: { userId: uid, isDefault: true },
    });

    if (!defaultCollection) {
      defaultCollection = await prisma.bookmarkCollection.create({
        data: { userId: uid, name: "默认收藏夹", isDefault: true },
      });
    }

    await prisma.bookmarkItem.create({
      data: { collectionId: defaultCollection.id, postId },
    });

    await createActivity(uid, "BOOKMARK_ADDED", postId);

    return NextResponse.json({ isBookmarked: true });
  }
}
