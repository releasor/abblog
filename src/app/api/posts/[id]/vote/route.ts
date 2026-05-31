import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
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

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { score: true },
    });

    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    let userVote = null;
    if (userId) {
      const vote = await prisma.postVote.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { value: true },
      });
      userVote = vote?.value ?? null;
    }

    return NextResponse.json(
      { score: post.score, userVote },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    console.error("[Vote] Failed to fetch vote status:", e);
    return NextResponse.json({ error: "获取投票状态失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`vote:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { value } = body;

    if (value !== 1 && value !== -1) {
      return NextResponse.json({ error: "投票值必须为 1 或 -1" }, { status: 400 });
    }

    const existing = await prisma.postVote.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true, value: true },
    });

    let vote;
    let scoreDelta = 0;

    if (existing) {
      if (existing.value === value) {
        await prisma.postVote.delete({ where: { id: existing.id } });
        scoreDelta = -value;
        vote = null;
      } else {
        vote = await prisma.postVote.update({
          where: { id: existing.id },
          data: { value },
        });
        scoreDelta = value * 2;
      }
    } else {
      try {
        vote = await prisma.postVote.create({
          data: { postId, userId, value },
        });
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "P2002") {
          // Race condition: another request created the vote concurrently
          const retryVote = await prisma.postVote.findUnique({
            where: { postId_userId: { postId, userId } },
            select: { value: true },
          });
          if (retryVote) {
            const currentPost = await prisma.post.findUnique({
              where: { id: postId },
              select: { score: true },
            });
            return NextResponse.json({ userVote: retryVote.value, score: currentPost?.score ?? 0 });
          }
        }
        throw e;
      }
      scoreDelta = value;
      if (value === 1) {
        await createActivity(userId, "LIKE_ADDED", postId);
      }
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: { score: { increment: scoreDelta } },
      select: { score: true },
    });

    return NextResponse.json({ userVote: vote?.value ?? null, score: post.score });
  } catch (e) {
    console.error("[Vote] Failed to vote:", e);
    return NextResponse.json({ error: "投票失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.postVote.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true, value: true },
    });

    if (!existing) return NextResponse.json({ error: "未找到投票记录" }, { status: 404 });

    await Promise.all([
      prisma.postVote.delete({ where: { id: existing.id } }),
      prisma.post.update({
        where: { id: postId },
        data: { score: { decrement: existing.value } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Vote] Failed to remove vote:", e);
    return NextResponse.json({ error: "取消投票失败" }, { status: 500 });
  }
}
