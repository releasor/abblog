import { NextRequest } from "next/server";
import { POST, GET } from "../route";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    shareStat: { upsert: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock("@/lib/api-utils", () => ({
  requireId: jest.fn((id: string) => {
    const n = Number(id);
    if (!id || isNaN(n) || n < 1) throw new Error("Invalid ID");
    return n;
  }),
  invalidIdResponse: jest.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
  getClientIp: jest.fn(() => "127.0.0.1"),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: jest.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  shareStat: { upsert: jest.Mock; findMany: jest.Mock };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/posts/[id]/share", () => {
  beforeEach(() => jest.clearAllMocks());

  it("increments share count for valid platform", async () => {
    mockPrisma.shareStat.upsert.mockResolvedValue({ id: 1, postId: 1, platform: "weibo", count: 1 });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/share", {
        method: "POST",
        body: JSON.stringify({ platform: "weibo" }),
      }),
      makeParams("1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockPrisma.shareStat.upsert).toHaveBeenCalledWith({
      where: { postId_platform: { postId: 1, platform: "weibo" } },
      update: { count: { increment: 1 } },
      create: { postId: 1, platform: "weibo", count: 1 },
    });
  });

  it("returns 400 for missing platform", async () => {
    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/share", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("1")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid platform", async () => {
    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/share", {
        method: "POST",
        body: JSON.stringify({ platform: "facebook" }),
      }),
      makeParams("1")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid id", async () => {
    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/abc/share", {
        method: "POST",
        body: JSON.stringify({ platform: "weibo" }),
      }),
      makeParams("abc")
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.shareStat.upsert.mockRejectedValue(new Error("DB error"));

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/share", {
        method: "POST",
        body: JSON.stringify({ platform: "twitter" }),
      }),
      makeParams("1")
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/posts/[id]/share", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns share stats grouped by platform", async () => {
    mockPrisma.shareStat.findMany.mockResolvedValue([
      { platform: "weibo", count: 5 },
      { platform: "twitter", count: 3 },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/share"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ weibo: 5, twitter: 3 });
  });

  it("returns empty object when no shares", async () => {
    mockPrisma.shareStat.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/share"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({});
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc/share"), makeParams("abc"));
    expect(res.status).toBe(400);
  });
});
