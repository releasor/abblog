import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaFile: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
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
  requireId: vi.fn((id: string | number) => {
    const num = typeof id === "number" ? id : parseInt(id, 10);
    if (isNaN(num) || num <= 0) throw new Error("Invalid ID");
    return num;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
}));

vi.mock("fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  mediaFile: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/media/manage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/media/manage"));
    expect(res.status).toBe(401);
  });

  it("returns media files with pagination", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.mediaFile.findMany.mockResolvedValue([
      { id: 1, filename: "test.jpg", mimeType: "image/jpeg" },
    ]);
    mockPrisma.mediaFile.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/media/manage"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.files).toHaveLength(1);
    expect(data.pagination).toBeDefined();
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("filters by type", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.mediaFile.findMany.mockResolvedValue([]);
    mockPrisma.mediaFile.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/media/manage?type=image"));

    expect(mockPrisma.mediaFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mimeType: { startsWith: "image/" } }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.mediaFile.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/media/manage"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/media/manage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/media/manage", { method: "DELETE", body: JSON.stringify({ id: 1 }) }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/media/manage", { method: "DELETE", body: JSON.stringify({ id: 1 }) }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when no id provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await DELETE(makeRequest("http://localhost:3000/api/media/manage", { method: "DELETE", body: JSON.stringify({}) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("文件ID");
  });

  it("returns 403 when file not owned by user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.mediaFile.findUnique.mockResolvedValue({ id: 1, userId: 2, filename: "test.jpg" });

    const res = await DELETE(makeRequest("http://localhost:3000/api/media/manage", { method: "DELETE", body: JSON.stringify({ id: 1 }) }));
    expect(res.status).toBe(403);
  });

  it("deletes media file successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.mediaFile.findUnique.mockResolvedValue({ id: 1, userId: 1, filename: "test.jpg" });
    mockPrisma.mediaFile.delete.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost:3000/api/media/manage", { method: "DELETE", body: JSON.stringify({ id: 1 }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.mediaFile.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/media/manage", { method: "DELETE", body: JSON.stringify({ id: 1 }) }));
    expect(res.status).toBe(500);
  });
});
