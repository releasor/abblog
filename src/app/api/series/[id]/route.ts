import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seriesId = parseInt(id);
    if (isNaN(seriesId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const series = await prisma.postSeries.findUnique({
      where: { id: seriesId },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
        posts: {
          include: { post: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, coverImageUrl: true } } },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { ...series, posts: series.posts.map((sp) => ({ ...sp.post, order: sp.order })) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("[Series] Failed to fetch series:", e);
    return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const seriesId = parseInt(id);
    if (isNaN(seriesId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
    if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (series.userId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const updated = await prisma.postSeries.update({
      where: { id: seriesId },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        coverImage: body.coverImage ?? undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[Series] Failed to update series:", e);
    return NextResponse.json({ error: "Failed to update series" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const seriesId = parseInt(id);
    if (isNaN(seriesId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
    if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (series.userId !== parseInt(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.postSeries.delete({ where: { id: seriesId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Series] Failed to delete series:", e);
    return NextResponse.json({ error: "Failed to delete series" }, { status: 500 });
  }
}
