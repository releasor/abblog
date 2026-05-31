import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

// Mock rate limit to allow requests by default
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { search: { windowMs: 60000, max: 30 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> };
const mockCheckRateLimit = checkRateLimit as unknown as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 });
  });

  it("returns 400 for empty query", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/search?q="));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("请输入搜索关键词");
  });

  it("returns 400 for missing query", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/search"));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("请输入搜索关键词");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
    const res = await GET(makeRequest("http://localhost:3000/api/search?q=test"));
    expect(res.status).toBe(429);
  });

  it("returns search results", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 1,
        title: "Test Post",
        slug: "test-post",
        excerpt: "A test excerpt",
        content: "Test content here",
        publishedAt: new Date("2025-01-01"),
        categoryName: "Tech",
        categorySlug: "tech",
        relevance: 1.5,
      },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/search?q=test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.query).toBe("test");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe("Test Post");
    expect(data.results[0].category).toEqual({ name: "Tech", slug: "tech" });
  });

  it("returns suggestions when requested", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 1, title: "Test", slug: "test", excerpt: null, content: "", publishedAt: null, categoryName: null, categorySlug: null, relevance: 1 },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/search?q=test&suggestions=true"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0]).toEqual({ id: 1, title: "Test", slug: "test" });
  });

  it("returns 500 on database error", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest("http://localhost:3000/api/search?q=test"));
    expect(res.status).toBe(500);
  });
});
