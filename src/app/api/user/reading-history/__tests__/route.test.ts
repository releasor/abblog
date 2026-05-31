import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    readHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
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
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 100 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual };
});

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  readHistory: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/user/reading-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/user/reading-history"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns reading history with pagination", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const now = new Date();
    const mockHistory = [
      { id: 1, postId: 1, readAt: now, post: { id: 1, title: "Test", slug: "test", excerpt: null, coverImageUrl: null, category: { name: "Cat" } } },
    ];
    mockPrisma.readHistory.findMany.mockResolvedValue(mockHistory);
    mockPrisma.readHistory.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/user/reading-history?page=1&limit=10"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe(1);
    expect(data.items[0].post.title).toBe("Test");
    expect(data.pagination.total).toBe(1);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.readHistory.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/user/reading-history"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取阅读历史失败");
  });
});

describe("DELETE /api/user/reading-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/user/reading-history", { method: "DELETE" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("deletes specific post history when postId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.readHistory.deleteMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("http://localhost:3000/api/user/reading-history?postId=5", { method: "DELETE" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.readHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: 1, postId: 5 } });
  });

  it("deletes all history when no postId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.readHistory.deleteMany.mockResolvedValue({ count: 3 });

    const req = makeRequest("http://localhost:3000/api/user/reading-history", { method: "DELETE" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.readHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
  });

  it("returns 400 for invalid postId", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/user/reading-history?postId=abc", { method: "DELETE" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("无效ID");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.readHistory.deleteMany.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/user/reading-history", { method: "DELETE" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("删除阅读历史失败");
  });
});
