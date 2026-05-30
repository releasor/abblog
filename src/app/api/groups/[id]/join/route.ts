import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }

    const member = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId, role: "MEMBER" },
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
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!existing) return NextResponse.json({ error: "不是圈子成员" }, { status: 404 });

    await prisma.groupMember.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[GroupJoin] Failed to leave group:", e);
    return NextResponse.json({ error: "退出圈子失败" }, { status: 500 });
  }
}
