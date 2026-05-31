import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 60 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as ConstructorParameters<typeof NextRequest>[1]);
}

describe("GET /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("returns user profile", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const mockUser = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      username: "testuser",
      avatar: null,
      bio: "Test bio",
      website: null,
      location: null,
      createdAt: new Date(),
      _count: { followers: 5, following: 10, posts: 20, likes: 100, bookmarkCollections: 3 },
    };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Test User");
    expect(data._count.posts).toBe(20);
  });
});

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("昵称");
  });

  it("returns 400 for invalid username", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ username: "a" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("用户名");
  });

  it("returns 400 for duplicate username", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findFirst.mockResolvedValue({ id: 2 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ username: "existing" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("已被占用");
  });

  it("updates profile successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({
      id: 1,
      name: "New Name",
      username: "newusername",
      avatar: null,
      bio: "New bio",
      website: null,
      location: null,
    });

    const res = await PATCH(makeRequest("http://localhost:3000/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name", username: "newusername", bio: "New bio" }),
      headers: { "Content-Type": "application/json" },
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New Name");
    expect(data.username).toBe("newusername");
  });
});
