import { vi } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
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
  post: { findMany: ReturnType<typeof vi.fn> };
  category: { findMany: ReturnType<typeof vi.fn> };
  tag: { findMany: ReturnType<typeof vi.fn> };
  comment: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;

describe("GET /api/admin/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("exports all data", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 1, title: "Post 1", tags: [{ tag: { name: "React" } }], category: { name: "Tech" } },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([{ id: 1, name: "Tech" }]);
    mockPrisma.tag.findMany.mockResolvedValue([{ id: 1, name: "React" }]);
    mockPrisma.comment.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET();
    const data = JSON.parse(await res.text());

    expect(res.status).toBe(200);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].tags).toEqual(["React"]);
    expect(data.posts[0].categoryName).toBe("Tech");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockIsAdmin.mockReturnValue(true);
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
