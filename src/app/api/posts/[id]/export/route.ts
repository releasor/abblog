import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "markdown";

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { title: true, content: true, excerpt: true, publishedAt: true, author: { select: { name: true } } },
    });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    if (format === "markdown") {
      const md = `---\ntitle: "${post.title}"\nauthor: "${post.author.name}"\ndate: "${post.publishedAt?.toISOString() || ""}"\n---\n\n${post.content}`;
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(post.title)}.md"`,
        },
      });
    }

    return NextResponse.json({ error: "不支持的格式" }, { status: 400 });
  } catch (e) {
    console.error("[Export] Failed to export post:", e);
    return NextResponse.json({ error: "导出文章失败" }, { status: 500 });
  }
}
