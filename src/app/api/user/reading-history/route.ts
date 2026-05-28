import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const [history, total] = await Promise.all([
    prisma.readHistory.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { readAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        post: {
          select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, category: { select: { name: true } } },
        },
      },
    }),
    prisma.readHistory.count({ where: { userId: parseInt(userId) } }),
  ]);

  return NextResponse.json({
    items: history,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");

  if (postId) {
    await prisma.readHistory.deleteMany({ where: { userId: parseInt(userId), postId: parseInt(postId) } });
  } else {
    await prisma.readHistory.deleteMany({ where: { userId: parseInt(userId) } });
  }
  return NextResponse.json({ success: true });
}
