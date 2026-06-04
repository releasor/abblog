import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    const targetUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: targetUser.id } }),
      prisma.follow.count({ where: { followerId: targetUser.id } }),
    ]);

    let isFollowing = false;
    if (userId) {
      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: userId, followingId: targetUser.id } },
        select: { id: true },
      });
      isFollowing = !!existing;
    }

    return NextResponse.json({ isFollowing, followerCount, followingCount }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } });
  } catch (e) {
    console.error("[Follow] Failed to fetch follow status:", e);
    return NextResponse.json({ error: "获取关注状态失败" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`follow:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const targetUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const targetId = targetUser.id;

    if (userId === targetId) {
      return NextResponse.json({ error: "不能关注自己" }, { status: 400 });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: targetId } },
      select: { id: true },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      const followerCount = await prisma.follow.count({ where: { followingId: targetId } });
      return NextResponse.json({ isFollowing: false, followerCount });
    } else {
      try {
        await prisma.follow.create({ data: { followerId: userId, followingId: targetId } });
      } catch (e: unknown) {
        if ((e as { code?: string }).code !== "P2002") throw e;
      }
      const followerName = session?.user?.name || "有人";
      const followerUsername = session?.user?.username;

      const [followerCount] = await Promise.all([
        prisma.follow.count({ where: { followingId: targetId } }),
        prisma.notification.create({
          data: {
            userId: targetId,
            type: "FOLLOW",
            message: `${followerName}关注了你`,
            link: `/u/${followerUsername || userId}`,
          },
        }),
        createActivity(userId, "FOLLOW_USER", targetId),
      ]);

      return NextResponse.json({ isFollowing: true, followerCount });
    }
  } catch (e) {
    console.error("[Follow] Failed to toggle follow:", e);
    return NextResponse.json({ error: "关注操作失败" }, { status: 500 });
  }
}
