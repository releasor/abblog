import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addPoints, POINTS } from "@/lib/points";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const { page, limit, skip } = parsePagination(searchParams);

    const admin = isAdmin(session);

    // Admin sees all, users see only their own
    let where: Record<string, unknown> = {};
    if (!admin) {
      if (type === "sent") {
        where = { donorId: userId };
      } else if (type === "received") {
        where = { recipientId: userId };
      } else {
        where = { OR: [{ donorId: userId }, { recipientId: userId }] };
      }
    }
    // Admin with no type filter: where stays {} (all donations)

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
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
      pagination: paginationMeta(page, limit, total),
    }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } });
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

    const rl = checkRateLimit(`donate:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let recipientId: string, postId: string | undefined, amount: number, message: string | undefined;
    try {
      const body = await request.json();
      recipientId = body.recipientId;
      postId = body.postId;
      amount = body.amount;
      message = body.message;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    let rid: number;
    try { rid = requireId(recipientId); } catch { return invalidIdResponse(); }
    if (!amount || typeof amount !== "number" || amount < 100) {
      return NextResponse.json({ error: "参数无效（最低1元）" }, { status: 400 });
    }
    let pid: number | null = null;
    if (postId) {
      try { pid = requireId(postId); } catch { return invalidIdResponse(); }
    }

    if (userId === rid) {
      return NextResponse.json({ error: "不能给自己打赏" }, { status: 400 });
    }

    const donation = await prisma.donation.create({
      data: {
        donorId: userId,
        recipientId: rid,
        postId: pid,
        amount,
        message: typeof message === "string" ? message.trim().slice(0, 200) : null,
      },
    });

    await addPoints(rid, POINTS.DONATION_RECEIVED);

    return NextResponse.json(donation, { status: 201 });
  } catch (e) {
    console.error("[Donations] Failed to create donation:", e);
    return NextResponse.json({ error: "打赏失败" }, { status: 500 });
  }
}
