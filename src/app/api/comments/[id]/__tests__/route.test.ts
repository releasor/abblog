import { vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
  isAdmin: vi.fn(),
}));

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 30 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId, isAdmin } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  comment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("PATCH /api/comments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/comments/1", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(false);

    const req = makeRequest("http://localhost:3000/api/comments/1", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid status", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);

    const req = makeRequest("http://localhost:3000/api/comments/1", {
      method: "PATCH",
      body: JSON.stringify({ status: "INVALID" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when comment not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/comments/999", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("updates comment status successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.comment.update.mockResolvedValue({
      id: 1,
      status: "APPROVED",
      post: { id: 1, title: "Post", slug: "post" },
    });

    const req = makeRequest("http://localhost:3000/api/comments/1", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("APPROVED");
  });
});

describe("DELETE /api/comments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/comments/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when comment not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/comments/999", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when not owner and not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockIsAdmin.mockReturnValue(false);
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: 1 });

    const req = makeRequest("http://localhost:3000/api/comments/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("allows owner to delete", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(false);
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: 1 });
    mockPrisma.comment.delete.mockResolvedValue({});

    const req = makeRequest("http://localhost:3000/api/comments/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("allows admin to delete any comment", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 99 } });
    mockGetAuthUserId.mockReturnValue(99);
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: 1 });
    mockPrisma.comment.delete.mockResolvedValue({});

    const req = makeRequest("http://localhost:3000/api/comments/1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });
});
