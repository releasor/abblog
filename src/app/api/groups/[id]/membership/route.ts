import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

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
  let groupId: number;
  try { groupId = requireId(id); } catch { return invalidIdResponse(); }

  try {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    return NextResponse.json({ isMember: !!membership }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[Groups] Failed to check membership:", e);
    return NextResponse.json({ error: "检查成员状态失败" }, { status: 500 });
  }
}
