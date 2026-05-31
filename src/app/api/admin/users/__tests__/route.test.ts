import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn(() => ({ page: 1, limit: 20, skip: 0 })),
  paginationMeta: vi.fn((page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) })),
}));

vi.mock("@/lib/api-utils", () => ({
  requireId: vi.fn((id: string | number) => {
    const num = typeof id === "number" ? id : parseInt(id, 10);
    if (isNaN(num) || num <= 0) throw new Error("Invalid ID");
    return num;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { isAdmin } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/users"));
    expect(res.status).toBe(403);
  });

  it("returns users with pagination", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, name: "User", email: "u@test.com", username: "user", role: "USER", points: 0, level: 1 },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/users"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.users).toHaveLength(1);
    expect(data.pagination).toBeDefined();
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("searches users by query", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/admin/users?q=test"));

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: "test" }) }),
          ]),
        }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/admin/users"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "setRole", value: "ADMIN" }) }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "setRole", value: "ADMIN" }) }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: "invalid-json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing userId", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ action: "setRole", value: "ADMIN" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("参数无效");
  });

  it("returns 400 for unknown action", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "unknown", value: "x" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("未知操作");
  });

  it("sets role successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.user.update.mockResolvedValue({});

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "setRole", value: "ADMIN" }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "ADMIN" } })
    );
  });

  it("returns 400 for invalid role value", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "setRole", value: "SUPERADMIN" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("无效角色");
  });

  it("adds points successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.user.update.mockResolvedValue({});

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "addPoints", value: "100" }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { points: { increment: 100 } } })
    );
  });

  it("returns 400 for non-numeric points value", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "addPoints", value: "abc" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("数字");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId: "1", action: "setRole", value: "ADMIN" }) }));
    expect(res.status).toBe(500);
  });
});
