import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
  tag: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/tags/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tag with post count", async () => {
    const mockTag = { id: 1, name: "React", slug: "react", _count: { posts: 10 } };
    mockPrisma.tag.findUnique.mockResolvedValue(mockTag);

    const res = await GET(makeRequest("http://localhost:3000/api/tags/1"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockTag);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/tags/abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when tag not found", async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/tags/999"), { params: Promise.resolve({ id: "999" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("标签不存在");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.tag.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/tags/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/tags/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PUT(makeRequest("http://localhost:3000/api/tags/1", { method: "PUT", body: JSON.stringify({ name: "Test" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PUT(makeRequest("http://localhost:3000/api/tags/1", { method: "PUT", body: JSON.stringify({ name: "Test" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(429);
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PUT(makeRequest("http://localhost:3000/api/tags/1", { method: "PUT", body: JSON.stringify({ name: "" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("名称需要1-50个字符");
  });

  it("returns 404 when tag not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const res = await PUT(makeRequest("http://localhost:3000/api/tags/999", { method: "PUT", body: JSON.stringify({ name: "Test" }) }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findUnique.mockResolvedValue({ id: 1, name: "Old", slug: "old" });
    mockPrisma.tag.findFirst.mockResolvedValue({ id: 2 });

    const res = await PUT(makeRequest("http://localhost:3000/api/tags/1", { method: "PUT", body: JSON.stringify({ name: "Existing" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("该标签已存在");
  });

  it("updates tag successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findUnique.mockResolvedValue({ id: 1, name: "Old", slug: "old" });
    mockPrisma.tag.findFirst.mockResolvedValue(null);
    mockPrisma.tag.update.mockResolvedValue({ id: 1, name: "New", slug: "new", _count: { posts: 0 } });

    const res = await PUT(makeRequest("http://localhost:3000/api/tags/1", { method: "PUT", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New");
  });
});

describe("DELETE /api/tags/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/tags/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when tag not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/tags/999", { method: "DELETE" }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("deletes tag successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.tag.delete.mockResolvedValue({ id: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/tags/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/tags/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
