import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readdir, stat } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json(images);
  } catch {
    return NextResponse.json([]);
  }
}
