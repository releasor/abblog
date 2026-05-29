import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);
  if (!userId) {
    return NextResponse.json({ isMember: false });
  }

  const { id } = await params;
  const groupId = parseInt(id);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: "无效ID" }, { status: 400 });
  }

  try {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    return NextResponse.json({ isMember: !!membership });
  } catch (e) {
    console.error("[Groups] Failed to check membership:", e);
    return NextResponse.json({ error: "检查成员状态失败" }, { status: 500 });
  }
}
