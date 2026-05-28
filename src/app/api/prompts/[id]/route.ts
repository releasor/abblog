import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const prompt = await prisma.prompt.findFirst({
    where: { id: parseInt(id), userId: parseInt(userId) },
  });

  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
  }

  return NextResponse.json(prompt);
}

export async function PATCH(
  request: NextRequest,
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

  const body = await request.json();
  const { title, content, category, tags, variables, isPinned } = body;

  const prompt = await prisma.prompt.update({
    where: { id: parseInt(id) },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(category !== undefined && { category }),
      ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
      ...(variables !== undefined && { variables: variables ? JSON.stringify(variables) : null }),
      ...(isPinned !== undefined && { isPinned }),
    },
  });

  return NextResponse.json(prompt);
}

export async function DELETE(
  request: NextRequest,
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

  await prisma.prompt.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ success: true });
}
