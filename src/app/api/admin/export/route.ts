import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });
    const [posts, categories, tags, comments, users] = await Promise.all([
      prisma.post.findMany({
        include: { tags: { include: { tag: true } }, category: true },
      }),
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.comment.findMany(),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, username: true, points: true, level: true, createdAt: true },
      }),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      posts: posts.map((p) => ({
        ...p,
        tags: p.tags.map((pt) => pt.tag.name),
        categoryName: p.category?.name,
      })),
      categories,
      tags,
      comments,
      users,
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="billionaire-export-${Date.now()}.json"`,
      },
    });
  } catch (e) {
    console.error("[Admin Export] Failed to export data:", e);
    return NextResponse.json({ error: "导出数据失败" }, { status: 500 });
  }
}
