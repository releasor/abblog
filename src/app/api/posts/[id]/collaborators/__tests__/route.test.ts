import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
    postCollaborator: {
      findMany: vi.fn(),
      create: vi.fn(),
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
  post: { findUnique: ReturnType<typeof vi.fn> };
  postCollaborator: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/posts/[id]/collaborators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns collaborators list", async () => {
    mockPrisma.postCollaborator.findMany.mockResolvedValue([
      { user: { id: 2, name: "Editor", username: "editor", avatar: null }, role: "EDITOR" },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/collaborators"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc/collaborators"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.postCollaborator.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/collaborators"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/posts/[id]/collaborators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/collaborators", { method: "POST", body: JSON.stringify({ userId: 2 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when post not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/posts/999/collaborators", { method: "POST", body: JSON.stringify({ userId: 2 }) }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when not post author", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/collaborators", { method: "POST", body: JSON.stringify({ userId: 3 }) }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no userId provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: 1 });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/collaborators", { method: "POST", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请选择用户");
  });

  it("adds collaborator successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: 1 });
    mockPrisma.postCollaborator.create.mockResolvedValue({
      user: { id: 2, name: "Editor", username: "editor", avatar: null },
      role: "EDITOR",
    });

    const res = await POST(makeRequest("http://localhost:3000/api/posts/1/collaborators", { method: "POST", body: JSON.stringify({ userId: 2, role: "EDITOR" }) }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.role).toBe("EDITOR");
  });
});

describe("DELETE /api/posts/[id]/collaborators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/collaborators?userId=2", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not post author", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 2 } });
    mockGetAuthUserId.mockReturnValue(2);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/collaborators?userId=3", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no userId in query", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: 1 });

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/collaborators", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请选择用户");
  });

  it("removes collaborator successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ authorId: 1, userId: 1 });
    mockPrisma.postCollaborator.delete.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/collaborators?userId=2", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
