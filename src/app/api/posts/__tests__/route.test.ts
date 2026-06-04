import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/activity", () => ({ createActivity: vi.fn() }));
vi.mock("@/lib/points", () => ({ addPoints: vi.fn(), POINTS: { POST_PUBLISHED: 10 } }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  post: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: "Test", content: "Content" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing title", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: JSON.stringify({ content: "Content" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for title too long", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: "a".repeat(201), content: "Content" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate slug", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ id: 1 });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: "Test", content: "Content", slug: "existing-slug" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("creates draft post successfully", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);
    mockPrisma.post.create.mockResolvedValue({
      id: 1,
      title: "Test Post",
      slug: "test-post",
      content: "Content",
      status: "DRAFT",
      publishedAt: null,
      category: null,
      tags: [],
    });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: "Test Post", content: "Content" }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.title).toBe("Test Post");
    expect(data.status).toBe("DRAFT");
  });

  it("returns 429 when rate limited", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: "Test", content: "Content" }),
      })
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid JSON", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts", {
        method: "POST",
        body: "invalid json",
      })
    );
    expect(res.status).toBe(400);
  });
});
