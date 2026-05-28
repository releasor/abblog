import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
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
          bookmarks: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const { name, username, bio, website, location } = body;

  if (username) {
    const existing = await prisma.user.findFirst({
      where: { username, id: { not: parseInt(userId) } },
    });
    if (existing) {
      return NextResponse.json({ error: "用户名已被占用" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{2,20}$/.test(username)) {
      return NextResponse.json({ error: "用户名只能包含字母、数字、下划线和连字符，2-20个字符" }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id: parseInt(userId) },
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
}
