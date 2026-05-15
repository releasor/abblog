import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = slugify(name);
  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(existing);
  }

  const tag = await prisma.tag.create({
    data: { name, slug },
  });

  return NextResponse.json(tag, { status: 201 });
}
