import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CACHE_PUBLIC_S_MAXAGE, CACHE_PUBLIC_STALE } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const follows = await prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: { id: true, name: true, username: true, avatar: true, bio: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(follows.map((f) => f.following), {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE}, stale-while-revalidate=${CACHE_PUBLIC_STALE}` },
    });
  } catch (e) {
    console.error("[Following] Failed to fetch following list:", e);
    return NextResponse.json({ error: "获取关注列表失败" }, { status: 500 });
  }
}
