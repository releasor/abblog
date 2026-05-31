import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`prompt-use:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let promptId: number;
    try { promptId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
    }

    const prompt = await prisma.prompt.update({
      where: { id: promptId },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json(prompt);
  } catch (e) {
    console.error("[PromptUse] Failed to record prompt usage:", e);
    return NextResponse.json({ error: "记录使用次数失败" }, { status: 500 });
  }
}
