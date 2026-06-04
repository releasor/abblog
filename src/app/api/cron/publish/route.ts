import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    const now = new Date();

    const scheduled = await prisma.post.findMany({
      where: {
        status: "DRAFT",
        scheduledAt: { lte: now },
      },
    });

    if (scheduled.length === 0) {
      return NextResponse.json({ published: 0 });
    }

    await prisma.post.updateMany({
      where: { id: { in: scheduled.map((p) => p.id) } },
      data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
    });

    return NextResponse.json(
      { published: scheduled.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[CronPublish] Failed to publish scheduled posts:", e);
    return NextResponse.json({ error: "发布定时文章失败" }, { status: 500 });
  }
}
