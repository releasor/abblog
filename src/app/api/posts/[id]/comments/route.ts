import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

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

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  // Check if user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // Rate limiting
  const userId_str = (session.user as { id?: string }).id || "unknown";
  const rl = checkRateLimit(`comment:${userId_str}`, RATE_LIMITS.comment);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "评论太频繁，请稍后再试" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "请输入评论内容" }, { status: 400 });
  }
  if (content.trim().length > 1000) {
    return NextResponse.json({ error: "评论不能超过1000个字符" }, { status: 400 });
  }

  // Verify post exists and is published
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const userId = parseInt((session.user as { id?: string }).id || "0");
  const user = await prisma.user.findUnique({ where: { id: userId } });
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
}
