import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CACHE_PUBLIC_S_MAXAGE, CACHE_PUBLIC_STALE, ADMIN_PAGE_SIZE } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "posts";

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (tab === "likes") {
      const likes = await prisma.like.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: ADMIN_PAGE_SIZE,
        include: {
          post: {
            select: {
              id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true,
              author: { select: { name: true } },
              user: { select: { name: true, username: true } },
            },
          },
        },
      });
      return NextResponse.json(likes.map((l) => l.post), {
        headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE}, stale-while-revalidate=${CACHE_PUBLIC_STALE}` },
      });
    }

    if (tab === "bookmarks") {
      const bookmarks = await prisma.bookmarkItem.findMany({
        where: { collection: { userId: user.id } },
        orderBy: { createdAt: "desc" },
        take: ADMIN_PAGE_SIZE,
        include: {
          post: {
            select: {
              id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true,
              author: { select: { name: true } },
              user: { select: { name: true, username: true } },
            },
          },
        },
      });
      return NextResponse.json(bookmarks.map((b) => b.post), {
        headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE}, stale-while-revalidate=${CACHE_PUBLIC_STALE}` },
      });
    }

    const posts = await prisma.post.findMany({
      where: { userId: user.id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true,
        author: { select: { name: true } },
        user: { select: { name: true, username: true } },
      },
    });

    return NextResponse.json(posts, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE}, stale-while-revalidate=${CACHE_PUBLIC_STALE}` },
    });
  } catch (e) {
    console.error("[UserPosts] Failed to fetch user posts:", e);
    return NextResponse.json({ error: "获取用户文章失败" }, { status: 500 });
  }
}
