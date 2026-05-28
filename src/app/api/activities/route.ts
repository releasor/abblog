import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;
  const userId = searchParams.get("userId");

  const where = userId ? { userId: parseInt(userId) } : {};

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
    }),
    prisma.activity.count({ where }),
  ]);

  return NextResponse.json({
    activities,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
