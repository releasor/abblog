import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`avatar:${userId}`, RATE_LIMITS.upload);
    if (!rl.allowed) {
      return NextResponse.json({ error: "上传太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "仅支持 JPG/PNG/GIF/WebP 格式" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小不能超过 2MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = EXT_MAP[file.type] || "jpg";
    const random = crypto.randomBytes(8).toString("hex");
    const fileName = `avatar-${userId}-${Date.now()}-${random}.${ext}`;
    const sanitized = path.basename(fileName);

    if (sanitized !== fileName || fileName.includes("..")) {
      return NextResponse.json({ error: "无效文件名" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, sanitized), buffer);

    const avatarUrl = `/uploads/avatars/${sanitized}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    return NextResponse.json({ avatar: avatarUrl }, { headers: getRateLimitHeaders(rl) });
  } catch (e) {
    console.error("[Avatar] Failed to upload avatar:", e);
    return NextResponse.json({ error: "上传头像失败" }, { status: 500 });
  }
}
