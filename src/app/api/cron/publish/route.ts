import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  return NextResponse.json({ published: scheduled.length });
}
