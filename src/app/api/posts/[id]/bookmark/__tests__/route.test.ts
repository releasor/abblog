import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookmarkItem: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    bookmarkCollection: { upsert: vi.fn() },
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
  bookmarkItem: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  bookmarkCollection: { upsert: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/posts/[id]/bookmark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns isBookmarked false when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(false);
  });

  it("returns isBookmarked true when bookmark exists", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue({ id: 1, postId: 1, collectionId: 1 });

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(true);
  });

  it("returns isBookmarked false when no bookmark exists", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(false);
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc/bookmark"), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/posts/[id]/bookmark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/bookmark", { method: "POST" }), makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("removes bookmark when already bookmarked", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue({ id: 1, postId: 1, collectionId: 1 });
    mockPrisma.bookmarkItem.deleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/bookmark", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(false);
    expect(mockPrisma.bookmarkItem.deleteMany).toHaveBeenCalled();
  });

  it("creates bookmark when not already bookmarked", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue(null);
    mockPrisma.bookmarkCollection.upsert.mockResolvedValue({ id: 1, userId: 1, name: "默认收藏夹" });
    mockPrisma.bookmarkItem.create.mockResolvedValue({ id: 1, collectionId: 1, postId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/bookmark", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(true);
    expect(mockPrisma.bookmarkCollection.upsert).toHaveBeenCalled();
    expect(mockPrisma.bookmarkItem.create).toHaveBeenCalled();
  });

  it("handles P2002 race condition gracefully", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue(null);
    mockPrisma.bookmarkCollection.upsert.mockResolvedValue({ id: 1, userId: 1, name: "默认收藏夹" });
    mockPrisma.bookmarkItem.create.mockRejectedValue({ code: "P2002" });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/bookmark", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(true);
  });

  it("returns 400 for invalid id", async () => {
    const res = await POST(makeRequest("http://localhost:3000/api/posts/abc/bookmark", { method: "POST" }), makeParams("abc"));
    expect(res.status).toBe(400);
  });
});
