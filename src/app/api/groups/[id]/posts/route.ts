import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 12;

  const groupId = parseInt(id);
  if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [posts, total] = await Promise.all([
    prisma.groupPost.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        post: {
          include: {
            category: { select: { name: true, slug: true } },
            user: { select: { id: true, name: true, username: true } },
          },
        },
      },
    }),
    prisma.groupPost.count({ where: { groupId } }),
  ]);

  return NextResponse.json({
    posts: posts.map((gp) => gp.post),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id);
  if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: parseInt(userId) } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
  const postIdNum = parseInt(postId);
  if (isNaN(postIdNum)) return NextResponse.json({ error: "Invalid postId" }, { status: 400 });

  const gp = await prisma.groupPost.create({
    data: { groupId, postId: postIdNum },
  });
  return NextResponse.json(gp, { status: 201 });
}
