import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { CACHE_PRIVATE_MAX_AGE, CACHE_PRIVATE_STALE } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ isMember: false });
    }

    const { id } = await params;
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
      select: { id: true },
    });

    return NextResponse.json({ isMember: !!membership }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE}, stale-while-revalidate=${CACHE_PRIVATE_STALE}` } });
  } catch (e) {
    console.error("[Groups] Failed to check membership:", e);
    return NextResponse.json({ error: "检查成员状态失败" }, { status: 500 });
  }
}
