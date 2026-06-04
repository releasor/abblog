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
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
            likes: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(user, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE}, stale-while-revalidate=${CACHE_PUBLIC_STALE}` },
    });
  } catch (e) {
    console.error("[User] Failed to fetch user:", e);
    return NextResponse.json({ error: "获取用户信息失败" }, { status: 500 });
  }
}
