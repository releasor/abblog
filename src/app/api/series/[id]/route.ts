import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await prisma.postSeries.findUnique({
    where: { id: parseInt(id) },
    include: {
      user: { select: { id: true, name: true, username: true, avatar: true } },
      posts: {
        include: { post: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, coverImageUrl: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...series, posts: series.posts.map((sp) => ({ ...sp.post, order: sp.order })) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const series = await prisma.postSeries.findUnique({ where: { id: parseInt(id) } });
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (series.userId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updated = await prisma.postSeries.update({
    where: { id: parseInt(id) },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      coverImage: body.coverImage ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const series = await prisma.postSeries.findUnique({ where: { id: parseInt(id) } });
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (series.userId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.postSeries.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
