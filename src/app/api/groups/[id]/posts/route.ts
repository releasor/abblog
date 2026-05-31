import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 12 });

    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }

    const [posts, total] = await Promise.all([
      prisma.groupPost.findMany({
        where: { groupId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              coverImageUrl: true,
              publishedAt: true,
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
        pagination: paginationMeta(page, limit, total),
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

    const rl = checkRateLimit(`group-post:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "请先加入圈子" }, { status: 403 });

    let postId: string;
    try {
      const body = await request.json();
      postId = body.postId;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!postId) return NextResponse.json({ error: "请选择文章" }, { status: 400 });
    let postIdNum: number;
    try { postIdNum = requireId(postId); } catch { return invalidIdResponse(); }

    const existing = await prisma.groupPost.findUnique({
      where: { groupId_postId: { groupId, postId: postIdNum } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "文章已在圈子中" }, { status: 409 });

    const gp = await prisma.groupPost.create({
      data: { groupId, postId: postIdNum },
    });
    return NextResponse.json(gp, { status: 201 });
  } catch (e) {
    console.error("[GroupPosts] Failed to add post to group:", e);
    return NextResponse.json({ error: "分享文章到圈子失败" }, { status: 500 });
  }
}
