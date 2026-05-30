import { NextRequest } from "next/server";
import { GET, POST } from "../route";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    bookmarkItem: { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    bookmarkCollection: { upsert: jest.fn() },
  },
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: jest.fn(),
}));
jest.mock("@/lib/activity", () => ({ createActivity: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: jest.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  bookmarkItem: { findFirst: jest.Mock; create: jest.Mock; deleteMany: jest.Mock };
  bookmarkCollection: { upsert: jest.Mock };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/posts/[id]/bookmark", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns isBookmarked false when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(false);
  });

  it("returns isBookmarked true when bookmark exists", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue({ id: 1, postId: 1, collectionId: 1 });

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(true);
  });

  it("returns isBookmarked false when no bookmark exists", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
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
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/bookmark"), makeParams("1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/posts/[id]/bookmark", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/bookmark", { method: "POST" }), makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("removes bookmark when already bookmarked", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.bookmarkItem.findFirst.mockResolvedValue({ id: 1, postId: 1, collectionId: 1 });
    mockPrisma.bookmarkItem.deleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/bookmark", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBookmarked).toBe(false);
    expect(mockPrisma.bookmarkItem.deleteMany).toHaveBeenCalled();
  });

  it("creates bookmark when not already bookmarked", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
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
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
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
