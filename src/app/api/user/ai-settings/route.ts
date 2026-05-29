import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("AI settings GET error:", e);
    return NextResponse.json({ error: "读取AI设置失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { aiApiKey, aiApiUrl, aiModel } = body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        aiApiKey: aiApiKey || null,
        aiApiUrl: aiApiUrl || null,
        aiModel: aiModel || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("AI settings PATCH error:", e);
    return NextResponse.json({ error: "保存AI设置失败" }, { status: 500 });
  }
}
