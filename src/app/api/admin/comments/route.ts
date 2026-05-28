import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const where: Record<string, unknown> = {};
  if (status !== "all" && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status;
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        post: { select: { id: true, title: true, slug: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return NextResponse.json({
    comments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ids, status } = await request.json();
  if (!ids?.length || !["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  await prisma.comment.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return NextResponse.json({ success: true, updated: ids.length });
}
