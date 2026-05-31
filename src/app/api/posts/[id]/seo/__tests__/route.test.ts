import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

vi.mock("@/lib/text", () => ({
  stripHtml: vi.fn((s: string) => s.replace(/<[^>]*>/g, "")),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  post: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const goodPost = {
  title: "A Well-Optimized Blog Post Title Here",
  content: "<p>" + "x".repeat(350) + "</p><h2>Section</h2><h3>Sub</h3><img src='test.jpg' alt='test'>",
  excerpt: "This is a well-written excerpt that provides a good summary of the blog post content for search engines.",
  slug: "well-optimized-post",
  coverImageUrl: "/uploads/cover.jpg",
  tags: [{ tag: { name: "React" } }, { tag: { name: "TypeScript" } }, { tag: { name: "Web" } }],
};

describe("GET /api/posts/[id]/seo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/seo"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when post not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/999/seo"), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns high score for well-optimized post", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(goodPost);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/seo"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBeGreaterThanOrEqual(80);
    expect(data.details.hasCover).toBe(true);
    expect(data.details.tagCount).toBe(3);
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("reports issues for poorly optimized post", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({
      title: "Short",
      content: "<p>Too short</p>",
      excerpt: null,
      slug: "short",
      coverImageUrl: null,
      tags: [],
    });

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/seo"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBeLessThan(50);
    expect(data.issues).toContain("标题太短 (建议10-60字符)");
    expect(data.issues).toContain("缺少摘要");
    expect(data.issues).toContain("内容太短 (建议至少300字)");
    expect(data.issues).toContain("缺少标签");
    expect(data.suggestions).toContain("添加封面图有助于社交分享");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/seo"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
