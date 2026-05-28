import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collectionId = parseInt(id);
  if (isNaN(collectionId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
  if (!collection || collection.userId !== parseInt(userId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updated = await prisma.bookmarkCollection.update({
    where: { id: collectionId },
    data: { name: body.name ?? undefined, description: body.description ?? undefined },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collectionId = parseInt(id);
  if (isNaN(collectionId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
  if (!collection || collection.userId !== parseInt(userId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (collection.isDefault) return NextResponse.json({ error: "Cannot delete default collection" }, { status: 400 });

  await prisma.bookmarkCollection.delete({ where: { id: collectionId } });
  return NextResponse.json({ success: true });
}
