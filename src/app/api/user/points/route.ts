import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLevelName, getProgressToNextLevel, LEVELS } from "@/lib/points";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true, level: true },
    });
    if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

    const progress = getProgressToNextLevel(user.points);

    return NextResponse.json({
      points: user.points,
      level: user.level,
      levelName: getLevelName(user.level),
      progress,
      allLevels: LEVELS,
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[UserPoints] Failed to fetch user points:", e);
    return NextResponse.json({ error: "获取积分信息失败" }, { status: 500 });
  }
}
