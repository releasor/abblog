import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

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

    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    const isAuthor = post.authorId === userId || post.userId === userId;
    if (!isAuthor) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { userId: targetUserId, role } = await request.json();
    if (!targetUserId) return NextResponse.json({ error: "请选择用户" }, { status: 400 });

    const collaborator = await prisma.postCollaborator.create({
      data: { postId, userId: parseInt(targetUserId), role: role || "EDITOR" },
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
    const postId = parseInt(id);
    if (isNaN(postId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (post.authorId !== userId && post.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) return NextResponse.json({ error: "请选择用户" }, { status: 400 });

    await prisma.postCollaborator.delete({
      where: { postId_userId: { postId, userId: parseInt(targetUserId) } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Collaborators] Failed to remove collaborator:", e);
    return NextResponse.json({ error: "移除协作者失败" }, { status: 500 });
  }
}
