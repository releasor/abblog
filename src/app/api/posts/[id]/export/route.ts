import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "markdown";

  const post = await prisma.post.findUnique({
    where: { id: parseInt(id) },
    select: { title: true, content: true, excerpt: true, publishedAt: true, author: { select: { name: true } } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (format === "markdown") {
    const md = `---\ntitle: "${post.title}"\nauthor: "${post.author.name}"\ndate: "${post.publishedAt?.toISOString() || ""}"\n---\n\n${post.content}`;
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(post.title)}.md"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}
