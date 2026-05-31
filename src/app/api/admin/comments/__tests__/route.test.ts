import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { window: 60000, max: 60 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { isAdmin } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  comment: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/admin/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/comments"));
    expect(res.status).toBe(403);
  });

  it("returns comments with pagination", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 1, authorName: "User", content: "Hello", status: "PENDING" },
    ]);
    mockPrisma.comment.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/comments"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.comments).toHaveLength(1);
    expect(data.pagination).toBeDefined();
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("filters by status", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.findMany.mockResolvedValue([]);
    mockPrisma.comment.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/admin/comments?status=APPROVED"));

    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "APPROVED" }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/admin/comments"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/comments", { method: "PATCH", body: JSON.stringify({ ids: [1], status: "APPROVED" }) }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/comments", { method: "PATCH", body: JSON.stringify({ ids: [1], status: "APPROVED" }) }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for empty ids", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/comments", { method: "PATCH", body: JSON.stringify({ ids: [], status: "APPROVED" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("参数无效");
  });

  it("returns 400 for invalid status", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/comments", { method: "PATCH", body: JSON.stringify({ ids: [1], status: "INVALID" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("状态值");
  });

  it("updates comments successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.updateMany.mockResolvedValue({ count: 2 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/comments", { method: "PATCH", body: JSON.stringify({ ids: [1, 2], status: "APPROVED" }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updated).toBe(2);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.updateMany.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/comments", { method: "PATCH", body: JSON.stringify({ ids: [1], status: "APPROVED" }) }));
    expect(res.status).toBe(500);
  });
});
