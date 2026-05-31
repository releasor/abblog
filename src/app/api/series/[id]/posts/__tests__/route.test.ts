import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, PATCH } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    postSeries: { findUnique: vi.fn() },
    seriesPost: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
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
  postSeries: { findUnique: ReturnType<typeof vi.fn> };
  seriesPost: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("POST /api/series/[id]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/series/1/posts", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not series owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/series/1/posts", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no postId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/series/1/posts", { method: "POST", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请选择文章");
  });

  it("adds post to series successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });
    mockPrisma.seriesPost.findFirst.mockResolvedValue({ order: 2 });
    mockPrisma.seriesPost.create.mockResolvedValue({ seriesId: 1, postId: 5, order: 3 });

    const res = await POST(makeRequest("http://localhost:3000/api/series/1/posts", { method: "POST", body: JSON.stringify({ postId: 5 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.order).toBe(3);
  });

  it("returns 49 for duplicate post in series", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });
    mockPrisma.seriesPost.findFirst.mockResolvedValue(null);
    mockPrisma.seriesPost.create.mockRejectedValue({ code: "P2002" });

    const res = await POST(makeRequest("http://localhost:3000/api/series/1/posts", { method: "POST", body: JSON.stringify({ postId: 1 }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("该文章已在系列中");
  });
});

describe("PATCH /api/series/[id]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/series/1/posts", { method: "PATCH", body: JSON.stringify({ order: [1, 2, 3] }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not series owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/series/1/posts", { method: "PATCH", body: JSON.stringify({ order: [1, 2] }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when order is not an array", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/series/1/posts", { method: "PATCH", body: JSON.stringify({ order: "invalid" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请提供排序数组");
  });

  it("reorders posts successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.postSeries.findUnique.mockResolvedValue({ userId: 1 });
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await PATCH(makeRequest("http://localhost:3000/api/series/1/posts", { method: "PATCH", body: JSON.stringify({ order: [3, 1, 2] }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
