import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    postVersion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    post: { update: vi.fn() },
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
  postVersion: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  post: { update: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/posts/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/versions"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns versions list", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postVersion.findMany.mockResolvedValue([
      { id: 2, title: "V2", excerpt: "Second", version: 2, createdAt: new Date() },
      { id: 1, title: "V1", excerpt: "First", version: 1, createdAt: new Date() },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/versions"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.versions).toHaveLength(2);
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postVersion.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/versions"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/posts/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/versions", { method: "POST", body: JSON.stringify({ versionId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no versionId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/versions", { method: "POST", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("缺少版本ID");
  });

  it("returns 404 when version not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postVersion.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/versions", { method: "POST", body: JSON.stringify({ versionId: 999 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("版本不存在");
  });

  it("returns 404 when version belongs to different post", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postVersion.findUnique.mockResolvedValue({ id: 1, postId: 2, title: "V1", content: "Old", excerpt: null });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/versions", { method: "POST", body: JSON.stringify({ versionId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("版本不存在");
  });

  it("restores version successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postVersion.findUnique.mockResolvedValue({ id: 1, postId: 1, title: "V1", content: "Old content", excerpt: "Old excerpt" });
    mockPrisma.post.update.mockResolvedValue({});

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/versions", { method: "POST", body: JSON.stringify({ versionId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { title: "V1", content: "Old content", excerpt: "Old excerpt" },
    });
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postVersion.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/versions", { method: "POST", body: JSON.stringify({ versionId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
