import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.postTemplate.findUnique({ where: { id: parseInt(id) } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.postTemplate.findUnique({ where: { id: parseInt(id) } });
  if (!existing || existing.userId !== parseInt(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await request.json();
  const template = await prisma.postTemplate.update({
    where: { id: parseInt(id) },
    data: {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      content: data.content ?? existing.content,
      category: data.category ?? existing.category,
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.postTemplate.findUnique({ where: { id: parseInt(id) } });
  if (!existing || existing.userId !== parseInt(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.postTemplate.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
