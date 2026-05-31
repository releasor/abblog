import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    like: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/activity", () => ({ createActivity: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  like: { count: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/posts/[id]/like", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns like count when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);
    mockPrisma.like.count.mockResolvedValue(5);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/like"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(5);
    expect(data.isLiked).toBe(false);
  });

  it("returns like status when authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.like.count.mockResolvedValue(3);
    mockPrisma.like.findUnique.mockResolvedValue({ id: 1, postId: 1, userId: 1 });

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/like"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(3);
    expect(data.isLiked).toBe(true);
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc/like"), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);
    mockPrisma.like.count.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/like"), makeParams("1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/posts/[id]/like", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/like", { method: "POST" }), makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("creates like when not already liked", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.like.create.mockResolvedValue({ id: 1, postId: 1, userId: 1 });
    mockPrisma.like.count.mockResolvedValue(4);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/like", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isLiked).toBe(true);
    expect(data.count).toBe(4);
    expect(mockPrisma.like.create).toHaveBeenCalledWith({ data: { postId: 1, userId: 1 } });
  });

  it("removes like when already liked", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.like.findUnique.mockResolvedValue({ id: 1, postId: 1, userId: 1 });
    mockPrisma.like.delete.mockResolvedValue({});
    mockPrisma.like.count.mockResolvedValue(2);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/like", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isLiked).toBe(false);
    expect(data.count).toBe(2);
    expect(mockPrisma.like.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("handles P2002 race condition gracefully", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.like.create.mockRejectedValue({ code: "P2002" });
    mockPrisma.like.count.mockResolvedValue(5);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/like", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isLiked).toBe(true);
  });

  it("returns 400 for invalid id", async () => {
    const res = await POST(makeRequest("http://localhost:3000/api/posts/abc/like", { method: "POST" }), makeParams("abc"));
    expect(res.status).toBe(400);
  });
});
