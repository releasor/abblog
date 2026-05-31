import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    postVersion: {
      findFirst: vi.fn(),
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
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 30 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// Mock activity
vi.mock("@/lib/activity", () => ({
  createActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  post: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  postVersion: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

const mockPost = {
  id: 1,
  title: "Test Post",
  slug: "test-post",
  content: "Test content",
  excerpt: null,
  coverImageUrl: null,
  status: "PUBLISHED",
  publishedAt: new Date("2025-01-01"),
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  isPinned: false,
  score: 0,
  readingTime: 1,
  authorId: 1,
  userId: null,
  categoryId: null,
  scheduledAt: null,
  category: null,
  tags: [],
  collaborators: [],
};

describe("GET /api/posts/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns post by id", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(mockPost);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Test Post");
    expect(data.tags).toEqual([]);
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when post not found", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/999"), {
      params: Promise.resolve({ id: "999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.post.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/posts/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/posts/1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/posts/abc", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/posts/1", {
      method: "PUT",
      body: "invalid",
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when post not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/posts/999", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when not author or collaborator", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.post.findUnique.mockResolvedValue({ ...mockPost, authorId: 1, collaborators: [] });

    const req = makeRequest("http://localhost:3000/api/posts/1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("updates post successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    // First call: find post by ID; second call: slug uniqueness check (null = available)
    mockPrisma.post.findUnique
      .mockResolvedValueOnce(mockPost)
      .mockResolvedValueOnce(null);
    mockPrisma.post.update.mockResolvedValue({ ...mockPost, title: "Updated Title" });

    const req = makeRequest("http://localhost:3000/api/posts/1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Updated Title");
  });

  it("allows collaborator with EDITOR role", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    // First call: find post by ID; second call: slug uniqueness check (null = available)
    mockPrisma.post.findUnique
      .mockResolvedValueOnce({
        ...mockPost,
        authorId: 1,
        collaborators: [{ id: 10 }],
      })
      .mockResolvedValueOnce(null);
    mockPrisma.post.update.mockResolvedValue({ ...mockPost, title: "Collab Edit" });

    const req = makeRequest("http://localhost:3000/api/posts/1", {
      method: "PUT",
      body: JSON.stringify({ title: "Collab Edit" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/posts/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/posts/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when post not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/posts/999", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when not owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: null });

    const req = makeRequest("http://localhost:3000/api/posts/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("deletes post successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: null });
    mockPrisma.post.delete.mockResolvedValue({});

    const req = makeRequest("http://localhost:3000/api/posts/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
