import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;
  const q = searchParams.get("q") || "";

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { username: { contains: q } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        points: true,
        level: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true, likes: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, action, value } = await request.json();
  if (!userId || !action) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  switch (action) {
    case "setRole":
      if (!["USER", "EDITOR", "ADMIN"].includes(value)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      await prisma.user.update({ where: { id: userId }, data: { role: value } });
      break;
    case "addPoints":
      await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: parseInt(value) || 0 } },
      });
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
