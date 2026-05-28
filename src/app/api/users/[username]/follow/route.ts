import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const followerCount = await prisma.follow.count({ where: { followingId: targetUser.id } });
  const followingCount = await prisma.follow.count({ where: { followerId: targetUser.id } });

  let isFollowing = false;
  if (userId) {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: parseInt(userId), followingId: targetUser.id } },
    });
    isFollowing = !!existing;
  }

  return NextResponse.json({ isFollowing, followerCount, followingCount });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const uid = parseInt(userId);
  const targetId = targetUser.id;

  if (uid === targetId) {
    return NextResponse.json({ error: "不能关注自己" }, { status: 400 });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: uid, followingId: targetId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    const followerCount = await prisma.follow.count({ where: { followingId: targetId } });
    return NextResponse.json({ isFollowing: false, followerCount });
  } else {
    await prisma.follow.create({ data: { followerId: uid, followingId: targetId } });
    const followerCount = await prisma.follow.count({ where: { followingId: targetId } });

    const followerName = session?.user?.name || "有人";
    const followerUsername = (session?.user as { username?: string })?.username;

    await prisma.notification.create({
      data: {
        userId: targetId,
        type: "FOLLOW",
        message: `${followerName}关注了你`,
        link: `/u/${followerUsername || uid}`,
      },
    });

    await createActivity(uid, "FOLLOW_USER", targetId);

    return NextResponse.json({ isFollowing: true, followerCount });
  }
}
