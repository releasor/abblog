import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
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
  RATE_LIMITS: { ai: { window: 60000, max: 10 } },
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

vi.mock("@/lib/text", () => ({
  stripHtml: vi.fn((html: string) => html.replace(/<[^>]*>/g, "")),
  truncate: vi.fn((text: string, len: number) => text.slice(0, len)),
}));

vi.mock("@/lib/ai-config", () => ({
  getAiConfig: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAiConfig } from "@/lib/ai-config";

const mockPrisma = prisma as unknown as {
  post: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;
const mockGetAiConfig = getAiConfig as ReturnType<typeof vi.fn>;

function makeRequest(url: string, body?: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body,
  });
}

describe("POST /api/ai/summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/ai/summarize", JSON.stringify({ postId: 1 })));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest("http://localhost:3000/api/ai/summarize", JSON.stringify({ postId: 1 })));
    expect(res.status).toBe(429);
  });

  it("returns 400 for missing postId", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/ai/summarize", JSON.stringify({})));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("文章ID");
  });

  it("returns 404 when post not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/ai/summarize", JSON.stringify({ postId: 999 })));
    expect(res.status).toBe(404);
  });

  it("returns truncated summary when no API key", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ title: "Test", content: "<p>Hello world content</p>" });
    mockGetAiConfig.mockResolvedValue({ apiKey: "", apiUrl: "", model: "" });

    const res = await POST(makeRequest("http://localhost:3000/api/ai/summarize", JSON.stringify({ postId: 1 })));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary).toBeDefined();
  });

  it("returns 500 on unexpected error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/ai/summarize", JSON.stringify({ postId: 1 })));
    expect(res.status).toBe(500);
  });
});
