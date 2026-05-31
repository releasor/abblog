import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookmarkCollection: { findUnique: vi.fn() },
    bookmarkItem: { create: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { window: 60000, max: 60 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/activity", () => ({
  createActivity: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireId: vi.fn((id: string | number) => {
    const num = typeof id === "number" ? id : parseInt(id, 10);
    if (isNaN(num) || num <= 0) throw new Error("Invalid ID");
    return num;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  bookmarkCollection: { findUnique: ReturnType<typeof vi.fn> };
  bookmarkItem: { create: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("POST /api/bookmarks/collections/[id]/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(429);
  });

  it("returns 403 when collection not owned by user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockResolvedValue({ id: 1, userId: 2 });

    const res = await POST(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no postId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockResolvedValue({ id: 1, userId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items", { method: "POST", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("请选择文章");
  });

  it("adds item to collection successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    mockPrisma.bookmarkItem.create.mockResolvedValue({ id: 1, collectionId: 1, postId: 5 });

    const res = await POST(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items", { method: "POST", body: JSON.stringify({ postId: 5 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.collectionId).toBe(1);
    expect(data.postId).toBe(5);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/bookmarks/collections/[id]/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items?postId=1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when collection not owned by user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockResolvedValue({ id: 1, userId: 2 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items?postId=1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no postId in query", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockResolvedValue({ id: 1, userId: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("请选择文章");
  });

  it("removes item from collection successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    mockPrisma.bookmarkItem.delete.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items?postId=5"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/bookmarks/collections/1/items?postId=1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
