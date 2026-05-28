import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const postId = parseInt(id);

  const versions = await prisma.postVersion.findMany({
    where: { postId },
    orderBy: { version: "desc" },
    select: { id: true, title: true, excerpt: true, version: true, createdAt: true },
  });

  return NextResponse.json(versions);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const postId = parseInt(id);
  const { versionId } = await request.json();

  const version = await prisma.postVersion.findUnique({ where: { id: parseInt(versionId) } });
  if (!version || version.postId !== postId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.post.update({
    where: { id: postId },
    data: { title: version.title, content: version.content, excerpt: version.excerpt },
  });

  return NextResponse.json({ success: true });
}
