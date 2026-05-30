import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id, postId } = await params;
    const seriesId = parseInt(id);
    const postIdNum = parseInt(postId);
    if (isNaN(seriesId) || isNaN(postIdNum)) {
      return NextResponse.json({ error: "无效ID" }, { status: 400 });
    }

    const series = await prisma.postSeries.findUnique({ where: { id: seriesId } });
    if (!series || series.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    await prisma.seriesPost.delete({
      where: { seriesId_postId: { seriesId, postId: postIdNum } },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[SeriesPosts] Failed to remove post from series:", e);
    return NextResponse.json({ error: "移除文章失败" }, { status: 500 });
  }
}
