import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
}
