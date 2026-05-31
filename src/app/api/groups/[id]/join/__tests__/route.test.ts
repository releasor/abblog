import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      upsert: vi.fn(),
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

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  groupMember: {
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("POST /api/groups/[id]/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/join", { method: "POST" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/join", { method: "POST" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(429);
  });

  it("joins group successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.upsert.mockResolvedValue({ id: 1, groupId: 1, userId: 1, role: "MEMBER" });

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/join", { method: "POST" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.role).toBe("MEMBER");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.upsert.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/groups/1/join", { method: "POST" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/groups/[id]/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1/join", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when not a member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1/join", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("不是圈子成员");
  });

  it("leaves group successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.groupMember.delete.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1/join", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.groupMember.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1/join", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
