import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id);
  const uid = parseInt(userId);

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: uid } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const member = await prisma.groupMember.create({
    data: { groupId, userId: uid, role: "MEMBER" },
  });
  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id);
  const uid = parseInt(userId);

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: uid } },
  });
  return NextResponse.json({ success: true });
}
