import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse, getClientIp } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    const ip = getClientIp(request);
    const rl = checkRateLimit(`read:${userId || ip}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "操作太频繁，请稍后再试" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    await prisma.readHistory.create({
      data: { postId, userId },
    });

    return NextResponse.json({ ok: true }, { headers: getRateLimitHeaders(rl) });
  } catch (e) {
    console.error("[Read] Failed to record read history:", e);
    return NextResponse.json({ error: "记录阅读历史失败" }, { status: 500 });
  }
}
