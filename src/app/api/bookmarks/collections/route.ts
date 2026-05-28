import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collections = await prisma.bookmarkCollection.findMany({
    where: { userId: parseInt(userId) },
    include: {
      items: {
        include: { post: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(collections.map((c) => ({ ...c, itemCount: c._count.items })));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await request.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const uid = parseInt(userId);
  const existingDefault = await prisma.bookmarkCollection.findFirst({ where: { userId: uid } });

  const collection = await prisma.bookmarkCollection.create({
    data: {
      userId: uid,
      name,
      description: description || null,
      isDefault: !existingDefault,
    },
  });

  return NextResponse.json(collection, { status: 201 });
}
