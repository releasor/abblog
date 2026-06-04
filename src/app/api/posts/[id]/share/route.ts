import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse, getClientIp } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PUBLIC_S_MAXAGE_MEDIUM, CACHE_PUBLIC_STALE_MEDIUM } from "@/lib/constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`share:${ip}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "操作太频繁，请稍后再试" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { platform } = body;

    const allowedPlatforms = ["weibo", "twitter", "wechat", "copy"];
    if (!platform || !allowedPlatforms.includes(platform)) {
      return NextResponse.json({ error: "无效的平台参数" }, { status: 400 });
    }

    await prisma.shareStat.upsert({
      where: { postId_platform: { postId, platform } },
      update: { count: { increment: 1 } },
      create: { postId, platform, count: 1 },
    });

    return NextResponse.json({ ok: true }, { headers: getRateLimitHeaders(rl) });
  } catch (e) {
    console.error("[Share] Failed to track share:", e);
    return NextResponse.json({ error: "记录分享失败" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const stats = await prisma.shareStat.findMany({
      where: { postId },
      select: { platform: true, count: true },
    });

    const result: Record<string, number> = {};
    for (const s of stats) {
      result[s.platform] = s.count;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_MEDIUM}, stale-while-revalidate=${CACHE_PUBLIC_STALE_MEDIUM}` },
    });
  } catch (e) {
    console.error("[Share] Failed to fetch share stats:", e);
    return NextResponse.json({ error: "获取分享统计失败" }, { status: 500 });
  }
}
