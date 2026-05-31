import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
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
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 30 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  group: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/groups", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns groups with pagination", async () => {
    const mockGroups = [
      {
        id: 1,
        name: "Test Group",
        slug: "test-group",
        description: null,
        coverImage: null,
        isPublic: true,
        createdAt: new Date(),
        owner: { id: 1, name: "Admin", username: "admin", avatar: null },
        _count: { members: 5, posts: 3 },
      },
    ];
    mockPrisma.group.findMany.mockResolvedValue(mockGroups);
    mockPrisma.group.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/groups"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].memberCount).toBe(5);
    expect(data.groups[0].postCount).toBe(3);
    expect(data.pagination.total).toBe(1);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.group.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/groups"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/groups", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for name too long", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "a".repeat(51) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates group successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.create.mockResolvedValue({
      id: 1,
      name: "New Group",
      slug: "new-group",
      description: null,
      coverImage: null,
      isPublic: true,
      ownerId: 1,
      owner: { id: 1, name: "Admin", username: "admin" },
    });

    const req = makeRequest("http://localhost:3000/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "New Group" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("New Group");
    expect(data.slug).toBe("new-group");
  });

  it("returns 409 for duplicate slug", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.group.create.mockRejectedValue({ code: "P2002" });

    const req = makeRequest("http://localhost:3000/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "Duplicate" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
