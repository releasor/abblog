import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
    }))
  );
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

    const userId = (session?.user as { id?: string })?.id;
    const name = session?.user?.name || body.name || "匿名用户";

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        name: name,
        userId: userId ? parseInt(userId) : null,
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
    console.error("Message creation error:", error);
    const message = error instanceof Error ? error.message : "发送失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
