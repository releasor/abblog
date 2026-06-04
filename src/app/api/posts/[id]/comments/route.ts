import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { CACHE_PUBLIC_S_MAXAGE, CACHE_PUBLIC_STALE, MAX_COMMENT_LENGTH } from "@/lib/constants";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const comments = await prisma.comment.findMany({
      where: { postId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        authorName: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ comments }, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE}, stale-while-revalidate=${CACHE_PUBLIC_STALE}` },
    });
  } catch (e) {
    console.error("[Comments] Failed to fetch comments:", e);
    return NextResponse.json({ error: "获取评论失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const session = await getServerSession(authOptions);
    const userIdNum = getAuthUserId(session);
    if (!userIdNum) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`comment:${userIdNum}`, RATE_LIMITS.comment);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "评论太频繁，请稍后再试" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "请输入评论内容" }, { status: 400 });
    }
    if (content.trim().length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: `评论不能超过${MAX_COMMENT_LENGTH}个字符` }, { status: 400 });
    }

    // Verify post exists and user exists in parallel
    const [post, user] = await Promise.all([
      prisma.post.findUnique({ where: { id: postId }, select: { id: true, status: true } }),
      prisma.user.findUnique({ where: { id: userIdNum }, select: { id: true, name: true, email: true } }),
    ]);
    if (!post || post.status !== "PUBLISHED") {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId: user.id,
        authorName: user.name,
        authorEmail: user.email,
        content: content.trim(),
        status: "APPROVED",
      },
    });

    // Create activity
    await createActivity(user.id, "COMMENT_ADDED", postId, { commentId: comment.id });

    return NextResponse.json(
      { message: "评论发表成功", comment: { id: comment.id, authorName: user.name, content: comment.content, createdAt: comment.createdAt } },
      { status: 201 }
    );
  } catch (e) {
    console.error("[Comments] Failed to create comment:", e);
    return NextResponse.json({ error: "发表评论失败" }, { status: 500 });
  }
}
