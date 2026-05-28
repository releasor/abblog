import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const seriesId = parseInt(id);
  const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
  if (!series || series.userId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const maxOrder = await prisma.seriesPost.findFirst({
    where: { seriesId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const sp = await prisma.seriesPost.create({
    data: { seriesId, postId: parseInt(postId), order: (maxOrder?.order ?? -1) + 1 },
  });
  return NextResponse.json(sp, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const seriesId = parseInt(id);
  const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
  if (!series || series.userId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { order: newOrder } = await request.json();
  if (!Array.isArray(newOrder)) return NextResponse.json({ error: "order array required" }, { status: 400 });

  await prisma.$transaction(
    newOrder.map((postId: number, index: number) =>
      prisma.seriesPost.update({
        where: { seriesId_postId: { seriesId, postId } },
        data: { order: index },
      })
    )
  );
  return NextResponse.json({ success: true });
}
