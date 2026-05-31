import { vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { auth: { windowMs: 60000, max: 5 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import bcrypt from "bcrypt";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockBcrypt = bcrypt as unknown as {
  compare: ReturnType<typeof vi.fn>;
  hash: ReturnType<typeof vi.fn>;
};

function makeRequest(body: string) {
  return new NextRequest(new URL("http://localhost:3000/api/user/password"), {
    method: "PATCH",
    body,
  });
}

describe("PATCH /api/user/password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PATCH(makeRequest(JSON.stringify({ currentPassword: "old", newPassword: "new123" })));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PATCH(makeRequest(JSON.stringify({ currentPassword: "old" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PATCH(makeRequest(JSON.stringify({ currentPassword: "old", newPassword: "123" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 for wrong current password", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: "hashed" });
    mockBcrypt.compare.mockResolvedValue(false);

    const res = await PATCH(makeRequest(JSON.stringify({ currentPassword: "wrong", newPassword: "new123456" })));
    expect(res.status).toBe(400);
  });

  it("changes password successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: "old-hashed" });
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue("new-hashed");
    mockPrisma.user.update.mockResolvedValue({});

    const res = await PATCH(makeRequest(JSON.stringify({ currentPassword: "oldpass", newPassword: "newpass123" })));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("密码修改成功");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordHash: "new-hashed" },
    });
  });
});
