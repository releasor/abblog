import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  post: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/posts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns posts with pagination", async () => {
    const mockPosts = [
      {
        id: 1,
        title: "Test Post",
        slug: "test-post",
        excerpt: "Test excerpt",
        content: "Test content",
        status: "PUBLISHED",
        publishedAt: new Date("2025-01-01"),
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        coverImageUrl: null,
        isPinned: false,
        score: 0,
        readingTime: 1,
        authorId: 1,
        userId: null,
        categoryId: null,
        scheduledAt: null,
        category: null,
        tags: [],
        _count: { comments: 0 },
      },
    ];

    mockPrisma.post.findMany.mockResolvedValue(mockPosts as never[]);
    mockPrisma.post.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/posts"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].title).toBe("Test Post");
    expect(data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("handles page and limit parameters", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);
    mockPrisma.post.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/posts?page=2&limit=5"));

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      })
    );
  });

  it("filters by status when provided", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);
    mockPrisma.post.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/posts?status=PUBLISHED"));

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts"));
    expect(res.status).toBe(500);
  });
});
