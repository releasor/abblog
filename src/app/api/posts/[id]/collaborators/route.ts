import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const collaborators = await prisma.postCollaborator.findMany({
      where: { postId },
      include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
    });
    return NextResponse.json(collaborators, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
  } catch (e) {
    console.error("[Collaborators] Failed to fetch collaborators:", e);
    return NextResponse.json({ error: "获取协作者列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`collaborator:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, userId: true } });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    const isAuthor = post.authorId === userId || post.userId === userId;
    if (!isAuthor) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let targetUserId: string, role: string | undefined;
    try {
      const body = await request.json();
      targetUserId = body.userId;
      role = body.role;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!targetUserId) return NextResponse.json({ error: "请选择用户" }, { status: 400 });
    let targetUid: number;
    try { targetUid = requireId(targetUserId); } catch { return invalidIdResponse(); }

    const allowedRoles = ["EDITOR", "VIEWER"] as const;
    type AllowedRole = (typeof allowedRoles)[number];
    const collaboratorRole: AllowedRole = allowedRoles.includes(role as AllowedRole) ? (role as AllowedRole) : "EDITOR";

    const collaborator = await prisma.postCollaborator.create({
      data: { postId, userId: targetUid, role: collaboratorRole },
      include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
    });
    return NextResponse.json(collaborator, { status: 201 });
  } catch (e) {
    console.error("[Collaborators] Failed to add collaborator:", e);
    return NextResponse.json({ error: "添加协作者失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, userId: true } });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (post.authorId !== userId && post.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) return NextResponse.json({ error: "请选择用户" }, { status: 400 });
    let targetUid: number;
    try { targetUid = requireId(targetUserId); } catch { return invalidIdResponse(); }

    await prisma.postCollaborator.delete({
      where: { postId_userId: { postId, userId: targetUid } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Collaborators] Failed to remove collaborator:", e);
    return NextResponse.json({ error: "移除协作者失败" }, { status: 500 });
  }
}
