import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    readHistory: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  readHistory: { findMany: ReturnType<typeof vi.fn> };
  post: { findMany: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const mockPost = {
  id: 1,
  title: "Test",
  slug: "test",
  excerpt: "Excerpt",
  coverImageUrl: null,
  publishedAt: new Date(),
  author: { name: "Author" },
  category: { name: "Tech", slug: "tech" },
};

describe("GET /api/posts/recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback posts for anonymous users", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);
    mockPrisma.post.findMany.mockResolvedValue([mockPost]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/recommend"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(mockPrisma.readHistory.findMany).not.toHaveBeenCalled();
  });

  it("uses read history for personalized recommendations", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.readHistory.findMany.mockResolvedValue([
      { post: { categoryId: 1, tags: [{ tagId: 10 }] } },
    ]);
    mockPrisma.post.findMany.mockResolvedValue([mockPost]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/recommend?postId=99"));

    expect(res.status).toBe(200);
    expect(mockPrisma.readHistory.findMany).toHaveBeenCalled();
  });

  it("clamps limit to 1-20 range", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);
    mockPrisma.post.findMany.mockResolvedValue([]);

    await GET(makeRequest("http://localhost:3000/api/posts/recommend?limit=100"));

    const callArgs = mockPrisma.post.findMany.mock.calls[0]?.[0];
    if (callArgs?.take) {
      expect(callArgs.take).toBeLessThanOrEqual(40); // limit * 2
    }
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/recommend"));

    expect(res.status).toBe(500);
  });

  it("sets Cache-Control header", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);
    mockPrisma.post.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/recommend"));

    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });
});
