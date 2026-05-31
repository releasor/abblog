import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    topic: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/slugify", () => ({
  slugify: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
}));

vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn(() => ({ page: 1, limit: 20, skip: 0 })),
  paginationMeta: vi.fn((page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 100 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId, isAdmin } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  topic: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns topics with pagination", async () => {
    const mockTopics = [
      { id: 1, name: "React", slug: "react", postCount: 10 },
      { id: 2, name: "TypeScript", slug: "typescript", postCount: 5 },
    ];
    mockPrisma.topic.findMany.mockResolvedValue(mockTopics);
    mockPrisma.topic.count.mockResolvedValue(2);

    const res = await GET(makeRequest("http://localhost:3000/api/topics"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.topics).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.topic.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/topics"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取话题列表失败");
  });
});

describe("POST /api/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(false);

    const req = makeRequest("http://localhost:3000/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: "Test Topic" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("无权限");
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);

    const req = makeRequest("http://localhost:3000/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请输入话题名称");
  });

  it("returns 400 for name exceeding 50 chars", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);

    const req = makeRequest("http://localhost:3000/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: "a".repeat(51) }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("话题名称不能超过50个字符");
  });

  it("creates topic successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.topic.create.mockResolvedValue({
      id: 1,
      name: "React",
      slug: "react",
      description: null,
      coverImage: null,
    });

    const req = makeRequest("http://localhost:3000/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: "React" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("React");
    expect(data.slug).toBe("react");
  });

  it("returns 409 for duplicate topic", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);
    const err = new Error("Unique constraint") as Error & { code: string };
    err.code = "P2002";
    mockPrisma.topic.create.mockRejectedValue(err);

    const req = makeRequest("http://localhost:3000/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: "React" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("该话题已存在");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.topic.create.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: "React" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("创建话题失败");
  });
});
