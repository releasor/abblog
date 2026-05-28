import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
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
      take: 20,
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
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }

  if (tab === "bookmarks") {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
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
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }

  const posts = await prisma.post.findMany({
    where: { userId: user.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: {
      id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true,
      author: { select: { name: true } },
      user: { select: { name: true, username: true } },
    },
  });

  return NextResponse.json(posts, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
