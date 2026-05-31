import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      count: vi.fn(),
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

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  comment: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/comments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/comments"));
    expect(res.status).toBe(401);
  });

  it("returns comments with pagination", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const mockComments = [
      { id: 1, authorName: "User", content: "Test", status: "APPROVED", createdAt: new Date(), post: { id: 1, title: "Post", slug: "post" } },
    ];
    mockPrisma.comment.findMany.mockResolvedValue(mockComments);
    mockPrisma.comment.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/comments"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.comments).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
  });

  it("filters by status", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.comment.findMany.mockResolvedValue([]);
    mockPrisma.comment.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/comments?status=PENDING"));

    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } })
    );
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.comment.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/comments"));
    expect(res.status).toBe(500);
  });
});
