import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    adminUser: {
      findFirst: vi.fn(),
      create: vi.fn(),
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
  post: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  adminUser: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(body: string) {
  return new NextRequest(new URL("http://localhost:3000/api/user/posts"), {
    method: "POST",
    body,
  });
}

const validBody = {
  title: "My Post",
  slug: "my-post",
  content: "<p>Hello world</p>",
  excerpt: "A post",
  status: "DRAFT",
};

describe("POST /api/user/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest(JSON.stringify(validBody)));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest(JSON.stringify(validBody)));
    expect(res.status).toBe(429);
  });

  it("returns 400 for missing title", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest(JSON.stringify({ slug: "s", content: "c" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("标题");
  });

  it("returns 400 for invalid slug", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest(JSON.stringify({ title: "T", slug: "Invalid Slug!", content: "c" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("slug");
  });

  it("returns 400 for duplicate slug", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ id: 99 });

    const res = await POST(makeRequest(JSON.stringify(validBody)));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("slug 已存在");
  });

  it("creates post successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);
    mockPrisma.adminUser.findFirst.mockResolvedValue({ id: 1 });
    mockPrisma.post.create.mockResolvedValue({ id: 1, title: "My Post", slug: "my-post" });

    const res = await POST(makeRequest(JSON.stringify(validBody)));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.title).toBe("My Post");
  });

  it("creates admin user if none exists", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);
    mockPrisma.adminUser.findFirst.mockResolvedValue(null);
    mockPrisma.adminUser.create.mockResolvedValue({ id: 1 });
    mockPrisma.post.create.mockResolvedValue({ id: 1, title: "My Post", slug: "my-post" });

    const res = await POST(makeRequest(JSON.stringify(validBody)));
    expect(res.status).toBe(201);
    expect(mockPrisma.adminUser.create).toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest(JSON.stringify(validBody)));
    expect(res.status).toBe(500);
  });
});
