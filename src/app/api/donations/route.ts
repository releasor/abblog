import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addPoints, POINTS } from "@/lib/points";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    const role = (session?.user as { role?: string })?.role;
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const isAdmin = role === "admin";

    // Admin sees all, users see only their own
    let where: Record<string, unknown> = {};
    if (!isAdmin) {
      if (type === "sent") {
        where = { donorId: userId };
      } else if (type === "received") {
        where = { recipientId: userId };
      } else {
        where = { OR: [{ donorId: userId }, { recipientId: userId }] };
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
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[Donations] Failed to fetch donations:", e);
    return NextResponse.json({ error: "获取打赏列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { recipientId, postId, amount, message } = await request.json();
    if (!recipientId || !amount || amount < 100) {
      return NextResponse.json({ error: "参数无效（最低1元）" }, { status: 400 });
    }

    if (userId === recipientId) {
      return NextResponse.json({ error: "不能给自己打赏" }, { status: 400 });
    }

    const donation = await prisma.donation.create({
      data: {
        donorId: userId,
        recipientId,
        postId: postId || null,
        amount,
        message,
      },
    });

    await addPoints(recipientId, POINTS.DONATION_RECEIVED);

    return NextResponse.json(donation, { status: 201 });
  } catch (e) {
    console.error("[Donations] Failed to create donation:", e);
    return NextResponse.json({ error: "打赏失败" }, { status: 500 });
  }
}
