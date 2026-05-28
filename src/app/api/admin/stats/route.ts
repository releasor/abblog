import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [totalPosts, totalUsers, totalComments, totalViews] = await Promise.all([
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count(),
    prisma.comment.count({ where: { status: "APPROVED" } }),
    prisma.readHistory.count(),
  ]);

  const recentStats = await prisma.siteStat.findMany({
    orderBy: { date: "desc" },
    take: 30,
  });

  const popularPosts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { score: "desc" },
    take: 10,
    select: { id: true, title: true, slug: true, score: true, _count: { select: { likes: true, comments: true } } },
  });

  return NextResponse.json({
    summary: { totalPosts, totalUsers, totalComments, totalViews },
    trend: recentStats.reverse(),
    popularPosts,
  });
}
