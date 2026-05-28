import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "week";
  const limit = parseInt(searchParams.get("limit") || "10");

  const now = new Date();
  let startDate: Date;

  if (period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      coverImageUrl: true,
      publishedAt: true,
      _count: {
        select: {
          likes: { where: { createdAt: { gte: startDate } } },
          comments: { where: { createdAt: { gte: startDate } } },
          readHistory: { where: { readAt: { gte: startDate } } },
        },
      },
    },
  });

  const scored = posts
    .map((post) => ({
      ...post,
      score: post._count.likes * 3 + post._count.comments * 2 + post._count.readHistory,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json(scored);
}
