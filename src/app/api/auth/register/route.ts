import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "注册请求过于频繁，请稍后再试" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  const body = await request.json();
  const { email, password, name } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "密码至少需要6个字符" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "请输入昵称" }, { status: 400 });
  }
  if (name.trim().length > 30) {
    return NextResponse.json({ error: "昵称不能超过30个字符" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Generate unique username from name
  let baseUsername = name.trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]/g, "")
    .slice(0, 15) || "user";
  let username = baseUsername;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      username,
    },
  });

  return NextResponse.json(
    { message: "注册成功", user: { id: user.id, email: user.email, name: user.name } },
    { status: 201 }
  );
}
