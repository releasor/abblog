import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.postTemplate.findMany({
    where: { userId: parseInt(userId) },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, content, category } = await request.json();
  if (!name || !content) return NextResponse.json({ error: "Name and content required" }, { status: 400 });

  const template = await prisma.postTemplate.create({
    data: {
      userId: parseInt(userId),
      name,
      description,
      content,
      category: category || "通用",
    },
  });

  return NextResponse.json(template, { status: 201 });
}
