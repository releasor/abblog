import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: jest.fn(), update: jest.fn() },
    postVote: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: jest.fn(),
}));
jest.mock("@/lib/activity", () => ({ createActivity: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: jest.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  post: { findUnique: jest.Mock; update: jest.Mock };
  postVote: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/posts/[id]/vote", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns score and null userVote when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);
    mockPrisma.post.findUnique.mockResolvedValue({ score: 10 });

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/vote"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBe(10);
    expect(data.userVote).toBeNull();
  });

  it("returns user vote when authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue({ score: 5 });
    mockPrisma.postVote.findUnique.mockResolvedValue({ value: 1 });

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/vote"), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBe(5);
    expect(data.userVote).toBe(1);
  });

  it("returns 404 for non-existent post", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/999/vote"), makeParams("999"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/posts/abc/vote"), makeParams("abc"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/posts/[id]/vote", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/vote", { method: "POST", body: JSON.stringify({ value: 1 }) }),
      makeParams("1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid vote value", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/vote", { method: "POST", body: JSON.stringify({ value: 2 }) }),
      makeParams("1")
    );
    expect(res.status).toBe(400);
  });

  it("creates upvote when no existing vote", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.postVote.findUnique.mockResolvedValue(null);
    mockPrisma.postVote.create.mockResolvedValue({ id: 1, value: 1 });
    mockPrisma.post.update.mockResolvedValue({ score: 6 });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/vote", { method: "POST", body: JSON.stringify({ value: 1 }) }),
      makeParams("1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.userVote).toBe(1);
    expect(data.score).toBe(6);
  });

  it("removes vote when same value voted again (toggle)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.postVote.findUnique.mockResolvedValue({ id: 1, value: 1 });
    mockPrisma.postVote.delete.mockResolvedValue({});
    mockPrisma.post.update.mockResolvedValue({ score: 4 });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/vote", { method: "POST", body: JSON.stringify({ value: 1 }) }),
      makeParams("1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.userVote).toBeNull();
    expect(data.score).toBe(4);
  });

  it("switches vote when different value voted", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.postVote.findUnique.mockResolvedValue({ id: 1, value: 1 });
    mockPrisma.postVote.update.mockResolvedValue({ id: 1, value: -1 });
    mockPrisma.post.update.mockResolvedValue({ score: 2 });

    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/1/vote", { method: "POST", body: JSON.stringify({ value: -1 }) }),
      makeParams("1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.userVote).toBe(-1);
    expect(data.score).toBe(2);
    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { score: { increment: -2 } },
      select: { score: true },
    });
  });

  it("returns 400 for invalid id", async () => {
    const res = await POST(
      makeRequest("http://localhost:3000/api/posts/abc/vote", { method: "POST", body: JSON.stringify({ value: 1 }) }),
      makeParams("abc")
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/posts/[id]/vote", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAuthUserId as jest.Mock).mockReturnValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/vote", { method: "DELETE" }), makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("removes existing vote", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.postVote.findUnique.mockResolvedValue({ id: 1, value: 1 });
    mockPrisma.postVote.delete.mockResolvedValue({});
    mockPrisma.post.update.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/vote", { method: "DELETE" }), makeParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 404 when no existing vote", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "1" } });
    (getAuthUserId as jest.Mock).mockReturnValue(1);
    mockPrisma.postVote.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/posts/1/vote", { method: "DELETE" }), makeParams("1"));
    expect(res.status).toBe(404);
  });
});
