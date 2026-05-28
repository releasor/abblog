import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLevelName, getProgressToNextLevel, LEVELS } from "@/lib/points";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
    select: { points: true, level: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const progress = getProgressToNextLevel(user.points);

  return NextResponse.json({
    points: user.points,
    level: user.level,
    levelName: getLevelName(user.level),
    progress,
    allLevels: LEVELS,
  });
}
