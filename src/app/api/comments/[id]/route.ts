import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    let commentId: number;
    try { commentId = requireId(id); } catch { return invalidIdResponse(); }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { status } = body;

    if (!status || !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "无效状态，必须为 PENDING、APPROVED 或 REJECTED" },
        { status: 400 }
      );
    }

    const existing = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return NextResponse.json({ error: "评论不存在" }, { status: 404 });
    }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { status },
      include: {
        post: { select: { id: true, title: true, slug: true } },
      },
    });

    return NextResponse.json(comment);
  } catch (e) {
    console.error("[Comment] Failed to update comment:", e);
    return NextResponse.json({ error: "更新评论失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    let commentId: number;
    try { commentId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return NextResponse.json({ error: "评论不存在" }, { status: 404 });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Comment] Failed to delete comment:", e);
    return NextResponse.json({ error: "删除评论失败" }, { status: 500 });
  }
}