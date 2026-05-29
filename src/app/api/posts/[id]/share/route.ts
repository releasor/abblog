import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "无效ID" }, { status: 400 });
    }

    const { platform } = await request.json();

    const allowedPlatforms = ["weibo", "twitter", "wechat", "copy"];
    if (!platform || !allowedPlatforms.includes(platform)) {
      return NextResponse.json({ error: "无效的平台参数" }, { status: 400 });
    }

    await prisma.shareStat.upsert({
      where: { postId_platform: { postId, platform } },
      update: { count: { increment: 1 } },
      create: { postId, platform, count: 1 },
    });

    return NextResponse.json({ ok: true });
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
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "无效ID" }, { status: 400 });
    }

    const stats = await prisma.shareStat.findMany({
      where: { postId },
    });

    const result: Record<string, number> = {};
    for (const s of stats) {
      result[s.platform] = s.count;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("[Share] Failed to fetch share stats:", e);
    return NextResponse.json({ error: "获取分享统计失败" }, { status: 500 });
  }
}
