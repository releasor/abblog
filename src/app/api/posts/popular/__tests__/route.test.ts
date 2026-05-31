import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  post: { findMany: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/posts/popular", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns popular posts with scores", async () => {
    const mockPosts = [
      { id: 1, title: "Post 1", slug: "post-1", _count: { likes: 10, comments: 5, readHistory: 20 } },
      { id: 2, title: "Post 2", slug: "post-2", _count: { likes: 3, comments: 8, readHistory: 15 } },
    ];
    mockPrisma.post.findMany.mockResolvedValue(mockPosts);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/popular"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    // score = likes*3 + comments*2 + reads
    expect(data[0].score).toBe(10 * 3 + 5 * 2 + 20); // 60
    expect(data[1].score).toBe(3 * 3 + 8 * 2 + 15); // 40
  });

  it("respects limit parameter", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    await GET(makeRequest("http://localhost:3000/api/posts/popular?limit=5"));

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 15 }) // limit * 3 for candidates
    );
  });

  it("defaults to week period", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    await GET(makeRequest("http://localhost:3000/api/posts/popular"));

    const calls = mockPrisma.post.findMany.mock.calls;
    expect(calls.length).toBe(3); // 3 parallel queries
  });

  it("accepts month period", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    await GET(makeRequest("http://localhost:3000/api/posts/popular?period=month"));

    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(3);
  });

  it("deduplicates posts across ranking signals", async () => {
    const post = { id: 1, title: "Post", slug: "post", _count: { likes: 10, comments: 5, readHistory: 20 } };
    mockPrisma.post.findMany.mockResolvedValue([post]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/popular?limit=10"));
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].score).toBe(60);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/popular"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取热门文章失败");
  });
});
