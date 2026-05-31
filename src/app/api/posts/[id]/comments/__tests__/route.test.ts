import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: { findMany: vi.fn(), create: vi.fn() },
    post: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/activity", () => ({ createActivity: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { comment: { windowMs: 60000, max: 5 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  comment: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  post: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/posts/[id]/comments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns approved comments", async () => {
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 1, authorName: "User", content: "Test comment", createdAt: new Date() },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/comments"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].content).toBe("Test comment");
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc/comments"), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.comment.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/comments"), makeParams("1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/posts/[id]/comments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates comment when authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ id: 1, status: "PUBLISHED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, name: "User", email: "user@test.com" });
    mockPrisma.comment.create.mockResolvedValue({
      id: 1, authorName: "User", content: "New comment", createdAt: new Date(),
    });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/comments", {
        method: "POST",
        body: JSON.stringify({ content: "New comment" }),
        headers: { "content-type": "application/json" },
      }),
      makeParams("1")
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.comment.content).toBe("New comment");
  });

  it("returns 401 when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/comments", {
        method: "POST",
        body: JSON.stringify({ content: "Test" }),
      }),
      makeParams("1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty content", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/comments", {
        method: "POST",
        body: JSON.stringify({ content: "" }),
      }),
      makeParams("1")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for content over 1000 chars", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/comments", {
        method: "POST",
        body: JSON.stringify({ content: "a".repeat(1001) }),
      }),
      makeParams("1")
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent post", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/999/comments", {
        method: "POST",
        body: JSON.stringify({ content: "Test" }),
      }),
      makeParams("999")
    );
    expect(res.status).toBe(404);
  });
});
