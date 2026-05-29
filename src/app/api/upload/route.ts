import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { compressImage, shouldCompress, getCompressFormat } from "@/lib/image-compress";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm",
];
const IMAGE_MAX = 10 * 1024 * 1024;   // 10MB (before compression)
const VIDEO_MAX = 50 * 1024 * 1024;  // 50MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // Rate limit
  const rl = checkRateLimit(`upload:${userId}`, RATE_LIMITS.upload);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "上传太频繁，请稍后再试" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "无效的表单数据" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
  }

  const isVideo = file.type.startsWith("video/");
  const maxSize = isVideo ? VIDEO_MAX : IMAGE_MAX;
  if (file.size > maxSize) {
    const limit = isVideo ? "50MB" : "10MB";
    return NextResponse.json({ error: `文件过大（最大 ${limit}）` }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  let outputBuffer: Buffer = buffer;
  let ext = EXT_MAP[file.type];

  // Compress images
  if (shouldCompress(file.type)) {
    try {
      const format = getCompressFormat(file.type);
      const compressed = await compressImage(buffer, { format });
      outputBuffer = compressed.buffer;
      ext = compressed.format === "webp" ? "webp" : ext;
    } catch (e) {
      // Fall back to original if compression fails
      console.error("[Upload] Image compression failed, using original:", e);
    }
  }

  const random = crypto.randomBytes(8).toString("hex");
  const filename = `${Date.now()}-${random}.${ext}`;
  const sanitized = path.basename(filename);

  if (sanitized !== filename || filename.includes("..")) {
    return NextResponse.json({ error: "无效文件名" }, { status: 400 });
  }

  const filepath = path.join(UPLOAD_DIR, sanitized);
  await writeFile(filepath, outputBuffer);

  // Get image dimensions if applicable
  let width: number | undefined;
  let height: number | undefined;
  if (shouldCompress(file.type)) {
    try {
      const meta = await sharp(outputBuffer).metadata();
      width = meta.width;
      height = meta.height;
    } catch (e) {
      console.error("[Upload] Failed to read image dimensions:", e);
    }
  }

  // Record in media library
  try {
    await prisma.mediaFile.create({
      data: {
        userId,
        filename: sanitized,
        originalName: file.name,
        mimeType: file.type,
        size: outputBuffer.length,
        width,
        height,
      },
    });
  } catch (e) {
    console.error("[Upload] Failed to record media file:", e);
  }

  return NextResponse.json(
    { url: `/uploads/${sanitized}` },
    { status: 201, headers: getRateLimitHeaders(rl) }
  );
}
