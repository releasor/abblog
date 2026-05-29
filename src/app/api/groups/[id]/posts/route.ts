import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 12;

    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

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

    return NextResponse.json(
      {
        posts: posts.map((gp) => gp.post),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (e) {
    console.error("[GroupPosts] Failed to fetch group posts:", e);
    return NextResponse.json({ error: "获取圈子文章失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) return NextResponse.json({ error: "请先加入圈子" }, { status: 403 });

    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) return NextResponse.json({ error: "无效文章ID" }, { status: 400 });

    const gp = await prisma.groupPost.create({
      data: { groupId, postId: postIdNum },
    });
    return NextResponse.json(gp, { status: 201 });
  } catch (e) {
    console.error("[GroupPosts] Failed to add post to group:", e);
    return NextResponse.json({ error: "分享文章到圈子失败" }, { status: 500 });
  }
}
