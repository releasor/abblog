import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
  group: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

const mockGroup = {
  id: 1,
  name: "Test Group",
  description: "A test group",
  ownerId: 1,
  owner: { id: 1, name: "Owner", username: "owner", avatar: null },
  members: [{ user: { id: 1, name: "Owner", username: "owner", avatar: null } }],
  _count: { members: 5, posts: 10 },
};

describe("GET /api/groups/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns group with member and post counts", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(mockGroup);

    const res = await GET(makeRequest("http://localhost:3000/api/groups/1"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Test Group");
    expect(data.memberCount).toBe(5);
    expect(data.postCount).toBe(10);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=120");
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/groups/abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when group not found", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/groups/999"), { params: Promise.resolve({ id: "999" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("圈子不存在");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.group.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/groups/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/groups/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/groups/1", { method: "PATCH", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/groups/1", { method: "PATCH", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(429);
  });

  it("returns 403 when not group owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.group.findUnique.mockResolvedValue({ ownerId: 1 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/groups/1", { method: "PATCH", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when group not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/groups/999", { method: "PATCH", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.findUnique.mockResolvedValue({ ownerId: 1 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/groups/1", { method: "PATCH", body: JSON.stringify({ name: "" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("圈子名称不能为空");
  });

  it("updates group successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.findUnique.mockResolvedValue({ ownerId: 1 });
    mockPrisma.group.update.mockResolvedValue({ id: 1, name: "Updated" });

    const res = await PATCH(makeRequest("http://localhost:3000/api/groups/1", { method: "PATCH", body: JSON.stringify({ name: "Updated", description: "New desc" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Updated");
  });
});

describe("DELETE /api/groups/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not group owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.group.findUnique.mockResolvedValue({ ownerId: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when group not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/999", { method: "DELETE" }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(403);
  });

  it("deletes group successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.findUnique.mockResolvedValue({ ownerId: 1 });
    mockPrisma.group.delete.mockResolvedValue({ id: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/groups/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
