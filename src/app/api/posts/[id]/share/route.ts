import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    const { platform } = await request.json();

    if (!platform) {
      return NextResponse.json({ error: "缺少平台参数" }, { status: 400 });
    }

    await prisma.shareStat.upsert({
      where: { postId_platform: { postId, platform } },
      update: { count: { increment: 1 } },
      create: { postId, platform, count: 1 },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Share] Failed to track share:", e);
    return NextResponse.json({ error: "Failed to track share" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);

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
    return NextResponse.json({ error: "Failed to fetch share stats" }, { status: 500 });
  }
}
