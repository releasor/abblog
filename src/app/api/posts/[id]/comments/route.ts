import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In-memory rate limit store: IP -> last submission timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 minute

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamp] of rateLimitMap) {
    if (now - timestamp > RATE_LIMIT_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_MS * 5);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      authorName: true,
      content: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  // Rate limiting by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const lastSubmission = rateLimitMap.get(ip);
  if (lastSubmission && now - lastSubmission < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Please wait before submitting another comment" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { authorName, authorEmail, content } = body;

  // Validation
  if (!authorName || typeof authorName !== "string" || authorName.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (authorName.trim().length > 50) {
    return NextResponse.json({ error: "Name must be 50 characters or less" }, { status: 400 });
  }
  if (!authorEmail || typeof authorEmail !== "string" || authorEmail.trim().length === 0) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
  }
  if (content.trim().length > 1000) {
    return NextResponse.json({ error: "Comment must be 1000 characters or less" }, { status: 400 });
  }

  // Verify post exists and is published
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
      content: content.trim(),
      status: "PENDING",
    },
  });

  // Update rate limit
  rateLimitMap.set(ip, now);

  return NextResponse.json(
    { message: "Comment submitted for review", comment: { id: comment.id } },
    { status: 201 }
  );
}
