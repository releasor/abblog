import { vi } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { count: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn() },
    comment: { count: vi.fn() },
    readHistory: { count: vi.fn() },
    siteStat: { findMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  isAdmin: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { isAdmin } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  post: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  user: { count: ReturnType<typeof vi.fn> };
  comment: { count: ReturnType<typeof vi.fn> };
  readHistory: { count: ReturnType<typeof vi.fn> };
  siteStat: { findMany: ReturnType<typeof vi.fn> };
};
const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;

describe("GET /api/admin/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin users", async () => {
    mockGetServerSession.mockResolvedValue({});
    mockIsAdmin.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns stats for admin users", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);

    mockPrisma.post.count.mockResolvedValue(10);
    mockPrisma.user.count.mockResolvedValue(5);
    mockPrisma.comment.count.mockResolvedValue(20);
    mockPrisma.readHistory.count.mockResolvedValue(100);
    mockPrisma.siteStat.findMany.mockResolvedValue([{ date: "2026-01-01", views: 50 }]);
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 1, title: "Test", slug: "test", score: 10, _count: { likes: 5, comments: 3 } },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary.totalPosts).toBe(10);
    expect(data.summary.totalUsers).toBe(5);
    expect(data.popularPosts).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.post.count.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
