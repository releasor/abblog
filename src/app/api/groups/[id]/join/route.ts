import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) return NextResponse.json({ error: "已经是成员" }, { status: 409 });

    const member = await prisma.groupMember.create({
      data: { groupId, userId, role: "MEMBER" },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    console.error("[GroupJoin] Failed to join group:", e);
    return NextResponse.json({ error: "加入圈子失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[GroupJoin] Failed to leave group:", e);
    return NextResponse.json({ error: "退出圈子失败" }, { status: 500 });
  }
}
