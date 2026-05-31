import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/user/notification-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns notification settings", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emailNotifications).toBe(true);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/user/notification-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/notification-settings", { method: "PATCH", body: JSON.stringify({ emailNotifications: true }) }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/notification-settings", { method: "PATCH", body: JSON.stringify({ emailNotifications: true }) }));
    expect(res.status).toBe(429);
  });

  it("updates notification settings", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.update.mockResolvedValue({});

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/notification-settings", { method: "PATCH", body: JSON.stringify({ emailNotifications: false }) }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { emailNotifications: false },
    });
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/notification-settings", { method: "PATCH", body: JSON.stringify({ emailNotifications: true }) }));
    expect(res.status).toBe(500);
  });
});
