import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteConfig: {
      findMany: vi.fn(),
      upsert: vi.fn(),
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
  siteConfig: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/admin/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns config list", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.siteConfig.findMany.mockResolvedValue([
      { key: "site_name", value: "billionaire" },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.siteConfig.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/admin/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await PUT(makeRequest("http://localhost:3000/api/admin/config", { method: "PUT", body: JSON.stringify({ configs: [{ key: "k", value: "v" }] }) }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PUT(makeRequest("http://localhost:3000/api/admin/config", { method: "PUT", body: JSON.stringify({ configs: [{ key: "k", value: "v" }] }) }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid configs", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    const res = await PUT(makeRequest("http://localhost:3000/api/admin/config", { method: "PUT", body: JSON.stringify({ configs: "not-array" }) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("参数无效");
  });

  it("updates configs successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.siteConfig.upsert.mockResolvedValue({});

    const res = await PUT(makeRequest("http://localhost:3000/api/admin/config", { method: "PUT", body: JSON.stringify({ configs: [{ key: "site_name", value: "new-name" }] }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.siteConfig.upsert.mockRejectedValue(new Error("DB error"));

    const res = await PUT(makeRequest("http://localhost:3000/api/admin/config", { method: "PUT", body: JSON.stringify({ configs: [{ key: "k", value: "v" }] }) }));
    expect(res.status).toBe(500);
  });
});
