import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prompt: {
      findMany: vi.fn(),
      create: vi.fn(),
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

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  prompt: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/prompts"));
    expect(res.status).toBe(401);
  });

  it("returns prompts list", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.prompt.findMany.mockResolvedValue([
      { id: 1, title: "Prompt 1", content: "Hello" },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/prompts"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("filters by category", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.prompt.findMany.mockResolvedValue([]);

    await GET(makeRequest("http://localhost:3000/api/prompts?category=写作"));

    expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "写作" }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.prompt.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/prompts"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/prompts", { method: "POST", body: JSON.stringify({ title: "T", content: "C" }) }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest("http://localhost:3000/api/prompts", { method: "POST", body: JSON.stringify({ title: "T", content: "C" }) }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for missing title", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/prompts", { method: "POST", body: JSON.stringify({ content: "C" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("标题");
  });

  it("returns 400 for missing content", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/prompts", { method: "POST", body: JSON.stringify({ title: "T" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("内容");
  });

  it("creates prompt successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.prompt.create.mockResolvedValue({ id: 1, title: "My Prompt", content: "Hello" });

    const res = await POST(makeRequest("http://localhost:3000/api/prompts", { method: "POST", body: JSON.stringify({ title: "My Prompt", content: "Hello" }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("My Prompt");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.prompt.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/prompts", { method: "POST", body: JSON.stringify({ title: "T", content: "C" }) }));
    expect(res.status).toBe(500);
  });
});
