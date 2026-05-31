import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    postSeries: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 60 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  postSeries: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns series with pagination", async () => {
    const mockSeries = [
      {
        id: 1,
        name: "Test Series",
        slug: "test-series",
        userId: 1,
        posts: [],
        _count: { posts: 0 },
        user: { id: 1, name: "Test", username: "test", avatar: null },
      },
    ];
    mockPrisma.postSeries.findMany.mockResolvedValue(mockSeries);
    mockPrisma.postSeries.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/series"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.series).toHaveLength(1);
    expect(data.series[0].name).toBe("Test Series");
    expect(data.pagination.total).toBe(1);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.postSeries.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/series"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取系列列表失败");
  });
});

describe("POST /api/series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("操作太频繁，请稍后再试");
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: "invalid json",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请求格式无效");
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请输入系列名称");
  });

  it("returns 400 for name too long", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "a".repeat(101) }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("系列名称不能超过100个字符");
  });

  it("creates series successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.create.mockResolvedValue({
      id: 1,
      name: "New Series",
      slug: "new-series",
      userId: 1,
      user: { id: 1, name: "Test", username: "test" },
    });

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "New Series" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("New Series");
    expect(data.slug).toBe("new-series");
  });

  it("returns 409 for duplicate slug", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.create.mockRejectedValue({ code: "P2002" });

    const req = makeRequest("http://localhost:3000/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "Duplicate" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("该标识已存在");
  });
});
