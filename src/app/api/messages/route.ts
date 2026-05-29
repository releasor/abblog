import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(
      messages.map((m) => ({
        id: m.id,
        name: m.user?.name || m.name,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    console.error("[Messages] Failed to list messages:", e);
    return NextResponse.json({ error: "获取留言列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "请输入留言内容" }, { status: 400 });
    }

    if (content.length > 500) {
      return NextResponse.json({ error: "留言不能超过500字" }, { status: 400 });
    }

    const userId = getAuthUserId(session);
    const name = session?.user?.name || body.name || "匿名用户";

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        name: name,
        userId,
      },
    });

    return NextResponse.json(
      {
        id: message.id,
        name,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Messages] Failed to create message:", error);
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
}
