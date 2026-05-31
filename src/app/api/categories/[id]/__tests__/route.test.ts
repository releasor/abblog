import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      updateMany: vi.fn(),
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
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { window: 60000, max: 60 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/slugify", () => ({
  slugify: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  category: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  post: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns category with post count", async () => {
    const mockCategory = { id: 1, name: "Tech", slug: "tech", _count: { posts: 5 } };
    mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

    const res = await GET(makeRequest("http://localhost:3000/api/categories/1"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockCategory);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/categories/abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when category not found", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/categories/999"), { params: Promise.resolve({ id: "999" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("分类不存在");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.category.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/categories/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PUT(makeRequest("http://localhost:3000/api/categories/1", { method: "PUT", body: JSON.stringify({ name: "Test" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PUT(makeRequest("http://localhost:3000/api/categories/1", { method: "PUT", body: JSON.stringify({ name: "Test" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(429);
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PUT(makeRequest("http://localhost:3000/api/categories/1", { method: "PUT", body: JSON.stringify({ name: "" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("名称需要1-50个字符");
  });

  it("returns 404 when category not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const res = await PUT(makeRequest("http://localhost:3000/api/categories/999", { method: "PUT", body: JSON.stringify({ name: "Test" }) }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, name: "Old", slug: "old" });
    mockPrisma.category.findFirst.mockResolvedValue({ id: 2 });

    const res = await PUT(makeRequest("http://localhost:3000/api/categories/1", { method: "PUT", body: JSON.stringify({ name: "Existing" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("该分类已存在");
  });

  it("updates category successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, name: "Old", slug: "old" });
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.category.update.mockResolvedValue({ id: 1, name: "New", slug: "new", _count: { posts: 0 } });

    const res = await PUT(makeRequest("http://localhost:3000/api/categories/1", { method: "PUT", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New");
  });
});

describe("DELETE /api/categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/categories/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when category not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/categories/999", { method: "DELETE" }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("disassociates posts and deletes category", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.post.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.category.delete.mockResolvedValue({ id: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/categories/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
      where: { categoryId: 1 },
      data: { categoryId: null },
    });
    expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/categories/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
