import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.prompt.findFirst({
    where: { id: parseInt(id), userId: parseInt(userId) },
  });

  if (!existing) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
  }

  const prompt = await prisma.prompt.update({
    where: { id: parseInt(id) },
    data: { usageCount: { increment: 1 } },
  });

  return NextResponse.json(prompt);
}
