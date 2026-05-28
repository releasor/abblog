import { prisma } from "./prisma";
import { ActivityType } from "../../generated/prisma/enums";

export async function createActivity(
  userId: number,
  type: ActivityType,
  targetId?: number,
  metadata?: Record<string, unknown>
) {
  return prisma.activity.create({
    data: {
      userId,
      type,
      targetId: targetId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
