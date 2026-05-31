import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookmarkCollection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

const mockTx = {
  bookmarkCollection: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

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

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  bookmarkCollection: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/bookmarks/collections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns collections with item counts", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const mockCollections = [
      { id: 1, name: "Favorites", _count: { items: 5 }, items: [] },
    ];
    mockPrisma.bookmarkCollection.findMany.mockResolvedValue(mockCollections);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.collections).toHaveLength(1);
    expect(data.collections[0].itemCount).toBe(5);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.bookmarkCollection.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取收藏夹列表失败");
  });
});

describe("POST /api/bookmarks/collections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/bookmarks/collections", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/bookmarks/collections", {
      method: "POST",
      body: "invalid",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请求格式无效");
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/bookmarks/collections", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请输入收藏夹名称");
  });

  it("returns 400 for name exceeding 50 chars", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/bookmarks/collections", {
      method: "POST",
      body: JSON.stringify({ name: "a".repeat(51) }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("收藏夹名称不能超过50个字符");
  });

  it("creates collection successfully (first collection = default)", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    (mockTx.bookmarkCollection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockTx.bookmarkCollection.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, userId: 1, name: "My Collection", isDefault: true,
    });

    const req = makeRequest("http://localhost:3000/api/bookmarks/collections", {
      method: "POST",
      body: JSON.stringify({ name: "My Collection", description: "desc" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("My Collection");
    expect(data.isDefault).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.$transaction.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/bookmarks/collections", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("创建收藏夹失败");
  });
});
