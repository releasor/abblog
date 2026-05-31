import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    readHistory: { create: vi.fn() },
  },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/api-utils", () => ({
  requireId: vi.fn((id: string) => {
    const n = Number(id);
    if (!id || isNaN(n) || n < 1) throw new Error("Invalid ID");
    return n;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  readHistory: { create: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/posts/[id]/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok without recording when not authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/read", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockPrisma.readHistory.create).not.toHaveBeenCalled();
  });

  it("records read history when authenticated", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.readHistory.create.mockResolvedValue({ id: 1, postId: 1, userId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/read", { method: "POST" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockPrisma.readHistory.create).toHaveBeenCalledWith({ data: { postId: 1, userId: 1 } });
  });

  it("returns 400 for invalid id", async () => {
    const res = await POST(makeRequest("http://localhost:3000/api/posts/abc/read", { method: "POST" }), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as ReturnType<typeof vi.fn>).mockReturnValue(1);
    mockPrisma.readHistory.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/read", { method: "POST" }), makeParams("1"));
    expect(res.status).toBe(500);
  });
});
