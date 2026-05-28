import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        aiApiKey: true,
        aiApiUrl: true,
        aiModel: true,
      },
    });

    return NextResponse.json({
      aiApiKey: user?.aiApiKey || "",
      aiApiUrl: user?.aiApiUrl || "",
      aiModel: user?.aiModel || "",
    });
  } catch (e) {
    console.error("AI settings GET error:", e);
    return NextResponse.json({ error: "读取失败：" + (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { aiApiKey, aiApiUrl, aiModel } = body;

    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        aiApiKey: aiApiKey || null,
        aiApiUrl: aiApiUrl || null,
        aiModel: aiModel || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("AI settings PATCH error:", e);
    return NextResponse.json({ error: "保存失败：" + (e as Error).message }, { status: 500 });
  }
}
