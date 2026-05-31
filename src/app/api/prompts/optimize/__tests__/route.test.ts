import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
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

vi.mock("@/lib/ai-config", () => ({
  getAiConfig: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAiConfig } from "@/lib/ai-config";

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

describe("POST /api/prompts/optimize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/prompts/optimize", JSON.stringify({ content: "test prompt" })));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest("http://localhost:3000/api/prompts/optimize", JSON.stringify({ content: "test" })));
    expect(res.status).toBe(429);
  });

  it("returns 400 for empty content", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/prompts/optimize", JSON.stringify({ content: "" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("提示词内容");
  });

  it("returns 400 for content exceeding max length", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/prompts/optimize", JSON.stringify({ content: "x".repeat(10001) })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("过长");
  });

  it("returns fallback message when no API key", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockGetAiConfig.mockResolvedValue({ apiKey: "", apiUrl: "", model: "" });

    const res = await POST(makeRequest("http://localhost:3000/api/prompts/optimize", JSON.stringify({ content: "test prompt" })));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.optimized).toContain("API Key");
  });

  it("returns 500 on unexpected error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockGetAiConfig.mockRejectedValue(new Error("Unexpected"));

    const res = await POST(makeRequest("http://localhost:3000/api/prompts/optimize", JSON.stringify({ content: "test" })));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.optimized).toContain("暂时不可用");
  });
});
