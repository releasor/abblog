import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
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
            bookmarkCollections: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(user, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[UserProfile] Failed to fetch profile:", e);
    return NextResponse.json({ error: "获取个人资料失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`profile:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name, username, bio, website, location } = body;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0 || name.length > 50)) {
      return NextResponse.json({ error: "昵称需要1-50个字符" }, { status: 400 });
    }
    if (bio !== undefined && typeof bio === "string" && bio.length > 500) {
      return NextResponse.json({ error: "简介不能超过500个字符" }, { status: 400 });
    }
    if (website !== undefined && typeof website === "string" && website.length > 200) {
      return NextResponse.json({ error: "网站地址过长" }, { status: 400 });
    }

    if (username !== undefined && username !== null) {
      if (username === "") {
        return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
      }
      const existing = await prisma.user.findFirst({
        where: { username, id: { not: userId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "用户名已被占用" }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_-]{2,20}$/.test(username)) {
        return NextResponse.json({ error: "用户名只能包含字母、数字、下划线和连字符，2-20个字符" }, { status: 400 });
      }
    }

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined && { name }),
          ...(username !== undefined && { username }),
          ...(bio !== undefined && { bio }),
          ...(website !== undefined && { website }),
          ...(location !== undefined && { location }),
        },
        select: {
          id: true, name: true, username: true, avatar: true, bio: true, website: true, location: true,
        },
      });
      return NextResponse.json(user);
    } catch (updateErr: unknown) {
      if ((updateErr as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
      }
      throw updateErr;
    }
  } catch (e) {
    console.error("[UserProfile] Failed to update profile:", e);
    return NextResponse.json({ error: "更新个人资料失败" }, { status: 500 });
  }
}
