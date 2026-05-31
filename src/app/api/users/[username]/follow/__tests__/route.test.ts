import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    follow: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    notification: { create: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

vi.mock("@/lib/activity", () => ({
  createActivity: vi.fn(),
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
  user: { findUnique: ReturnType<typeof vi.fn> };
  follow: {
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  notification: { create: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/users/[username]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns follow status for unauthenticated user", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 2 });
    mockPrisma.follow.count.mockResolvedValue(10);

    const res = await GET(makeRequest("http://localhost:3000/api/users/target/follow"), { params: Promise.resolve({ username: "target" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isFollowing).toBe(false);
    expect(data.followerCount).toBe(10);
  });

  it("returns isFollowing true when user follows target", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 2 });
    mockPrisma.follow.count.mockResolvedValue(10);
    mockPrisma.follow.findUnique.mockResolvedValue({ id: 1 });

    const res = await GET(makeRequest("http://localhost:3000/api/users/target/follow"), { params: Promise.resolve({ username: "target" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isFollowing).toBe(true);
  });

  it("returns 404 when target user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/users/nobody/follow"), { params: Promise.resolve({ username: "nobody" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/users/[username]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/users/target/follow", { method: "POST" }), { params: Promise.resolve({ username: "target" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest("http://localhost:3000/api/users/target/follow", { method: "POST" }), { params: Promise.resolve({ username: "target" }) });
    expect(res.status).toBe(429);
  });

  it("returns 404 when target user not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/users/nobody/follow", { method: "POST" }), { params: Promise.resolve({ username: "nobody" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when trying to follow self", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/users/self/follow", { method: "POST" }), { params: Promise.resolve({ username: "self" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("不能关注自己");
  });

  it("unfollows when already following", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 2 });
    mockPrisma.follow.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.follow.delete.mockResolvedValue({});
    mockPrisma.follow.count.mockResolvedValue(9);

    const res = await POST(makeRequest("http://localhost:3000/api/users/target/follow", { method: "POST" }), { params: Promise.resolve({ username: "target" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isFollowing).toBe(false);
    expect(data.followerCount).toBe(9);
  });

  it("follows when not already following", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "Me", username: "me" } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 2 });
    mockPrisma.follow.findUnique.mockResolvedValue(null);
    mockPrisma.follow.create.mockResolvedValue({});
    mockPrisma.follow.count.mockResolvedValue(11);
    mockPrisma.notification.create.mockResolvedValue({});

    const res = await POST(makeRequest("http://localhost:3000/api/users/target/follow", { method: "POST" }), { params: Promise.resolve({ username: "target" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isFollowing).toBe(true);
    expect(data.followerCount).toBe(11);
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("http://localhost:3000/api/users/target/follow", { method: "POST" }), { params: Promise.resolve({ username: "target" }) });
    expect(res.status).toBe(500);
  });
});
