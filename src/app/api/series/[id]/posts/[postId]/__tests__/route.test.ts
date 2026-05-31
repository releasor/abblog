import { vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    postSeries: { findUnique: vi.fn() },
    seriesPost: { delete: vi.fn() },
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

vi.mock("@/lib/api-utils", () => ({
  requireId: vi.fn((id: string) => {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0) throw new Error("Invalid ID");
    return num;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  postSeries: { findUnique: ReturnType<typeof vi.fn> };
  seriesPost: { delete: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("DELETE /api/series/[id]/posts/[postId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/series/1/posts/5"), { params: Promise.resolve({ id: "1", postId: "5" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/series/1/posts/5"), { params: Promise.resolve({ id: "1", postId: "5" }) });
    expect(res.status).toBe(429);
  });

  it("returns 403 when not series owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 2 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/series/1/posts/5"), { params: Promise.resolve({ id: "1", postId: "5" }) });
    expect(res.status).toBe(403);
  });

  it("removes post from series successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });
    mockPrisma.seriesPost.delete.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost:3000/api/series/1/posts/5"), { params: Promise.resolve({ id: "1", postId: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.seriesPost.delete).toHaveBeenCalledWith({
      where: { seriesId_postId: { seriesId: 1, postId: 5 } },
    });
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/series/1/posts/5"), { params: Promise.resolve({ id: "1", postId: "5" }) });
    expect(res.status).toBe(500);
  });
});
