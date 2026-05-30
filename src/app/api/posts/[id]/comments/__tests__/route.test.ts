import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    comment: { findMany: jest.fn(), create: jest.fn() },
    post: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: jest.fn(),
}));
jest.mock("@/lib/activity", () => ({ createActivity: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { comment: { windowMs: 60000, max: 5 } },
  getRateLimitHeaders: jest.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  comment: { findMany: jest.Mock; create: jest.Mock };
  post: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/posts/[id]/comments", () => {
  beforeEach(() => jest.clearAllMocks());

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
  beforeEach(() => jest.clearAllMocks());

  it("creates comment when authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
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
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);

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
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);

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
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);

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
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
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
