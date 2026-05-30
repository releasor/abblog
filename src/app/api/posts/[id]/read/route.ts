import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    await prisma.readHistory.create({
      data: { postId, userId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Read] Failed to record read history:", e);
    return NextResponse.json({ error: "记录阅读历史失败" }, { status: 500 });
  }
}
