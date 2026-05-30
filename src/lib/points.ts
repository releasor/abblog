import { prisma } from "./prisma";

export const POINTS = {
  POST_PUBLISHED: 10,
  COMMENT: 2,
  LIKE_RECEIVED: 1,
  BOOKMARK_RECEIVED: 1,
  FOLLOWER_GAINED: 3,
  DONATION_RECEIVED: 5,
} as const;

export const LEVELS = [
  { level: 1, minPoints: 0, name: "新手" },
  { level: 2, minPoints: 50, name: "见习" },
  { level: 3, minPoints: 150, name: "进阶" },
  { level: 4, minPoints: 400, name: "资深" },
  { level: 5, minPoints: 800, name: "专家" },
  { level: 6, minPoints: 1500, name: "大师" },
  { level: 7, minPoints: 3000, name: "宗师" },
  { level: 8, minPoints: 5000, name: "传说" },
] as const;

export function getLevelForPoints(points: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return LEVELS[i].level;
  }
  return 1;
}

export function getLevelName(level: number): string {
  return LEVELS.find((l) => l.level === level)?.name || "新手";
}

export function getProgressToNextLevel(points: number): { current: number; next: number; progress: number } {
  const currentLevel = getLevelForPoints(points);
  const current = LEVELS.find((l) => l.level === currentLevel)!;
  const next = LEVELS.find((l) => l.level === currentLevel + 1);

  if (!next) return { current: current.minPoints, next: current.minPoints, progress: 100 };

  const progress = ((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100;
  return { current: current.minPoints, next: next.minPoints, progress: Math.min(100, progress) };
}

export async function addPoints(userId: number, points: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: points } },
    select: { points: true },
  });

  const newLevel = getLevelForPoints(user.points);
  await prisma.user.update({
    where: { id: userId },
    data: { level: newLevel },
  });
}
