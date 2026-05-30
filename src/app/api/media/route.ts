import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { readdir, stat } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  try {
    const files = await readdir(uploadsDir);
    const mediaExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm"];

    const images = await Promise.all(
      files
        .filter((f) => mediaExts.includes(path.extname(f).toLowerCase()))
        .map(async (filename) => {
          const filepath = path.join(uploadsDir, filename);
          const fileStat = await stat(filepath);
          return {
            filename,
            url: `/uploads/${filename}`,
            size: fileStat.size,
            createdAt: fileStat.birthtime.toISOString(),
          };
        })
    );

    images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(images, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[Media] Failed to list files:", e);
    return NextResponse.json({ error: "获取媒体文件失败" }, { status: 500 });
  }
}
