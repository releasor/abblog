import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupPost: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    groupMember: { findUnique: vi.fn() },
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

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  groupPost: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  groupMember: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/groups/[id]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns group posts with pagination", async () => {
    const mockPosts = [
      { post: { id: 1, title: "Post 1", slug: "post-1" } },
      { post: { id: 2, title: "Post 2", slug: "post-2" } },
    ];
    mockPrisma.groupPost.findMany.mockResolvedValue(mockPosts);
    mockPrisma.groupPost.count.mockResolvedValue(2);

    const res = await GET(makeRequest("http://localhost:3000/api/groups/1/posts"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=120");
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/groups/abc/posts"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.groupPost.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/groups/1/posts"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/groups/[id]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/posts", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not a group member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/posts", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("请先加入圈子");
  });

  it("returns 400 when no postId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/posts", { method: "POST", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请选择文章");
  });

  it("returns 409 for duplicate post in group", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.groupPost.findUnique.mockResolvedValue({ id: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/posts", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("文章已在圈子中");
  });

  it("adds post to group successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.groupPost.findUnique.mockResolvedValue(null);
    mockPrisma.groupPost.create.mockResolvedValue({ id: 1, groupId: 1, postId: 5 });

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/posts", { method: "POST", body: JSON.stringify({ postId: 5 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.postId).toBe(5);
  });
});
