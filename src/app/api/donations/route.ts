import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addPoints, POINTS } from "@/lib/points";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));

  const uid = parseInt(userId);
  const isAdmin = role === "ADMIN";

  // Admin sees all, users see only their own
  let where: Record<string, unknown> = {};
  if (!isAdmin) {
    if (type === "sent") {
      where = { donorId: uid };
    } else if (type === "received") {
      where = { recipientId: uid };
    } else {
      where = { OR: [{ donorId: uid }, { recipientId: uid }] };
    }
  } else if (type === "sent") {
    where = {};
  } else if (type === "received") {
    where = {};
  }

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        donor: { select: { id: true, name: true, avatar: true } },
        recipient: { select: { id: true, name: true, avatar: true } },
        post: { select: { id: true, title: true } },
      },
    }),
    prisma.donation.count({ where }),
  ]);

  return NextResponse.json({
    donations,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipientId, postId, amount, message } = await request.json();
  if (!recipientId || !amount || amount < 100) {
    return NextResponse.json({ error: "Invalid params (min 1 yuan)" }, { status: 400 });
  }

  if (parseInt(userId) === recipientId) {
    return NextResponse.json({ error: "Cannot donate to self" }, { status: 400 });
  }

  const donation = await prisma.donation.create({
    data: {
      donorId: parseInt(userId),
      recipientId,
      postId: postId || null,
      amount,
      message,
    },
  });

  await addPoints(recipientId, POINTS.DONATION_RECEIVED);

  return NextResponse.json(donation, { status: 201 });
}
