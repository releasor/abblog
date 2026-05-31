import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    post: { findMany: vi.fn() },
    like: { findMany: vi.fn() },
    bookmarkItem: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  post: { findMany: ReturnType<typeof vi.fn> };
  like: { findMany: ReturnType<typeof vi.fn> };
  bookmarkItem: { findMany: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/users/[username]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/users/nobody/posts"), { params: Promise.resolve({ username: "nobody" }) });
    expect(res.status).toBe(404);
  });

  it("returns user posts", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 1, title: "Post 1", slug: "post-1" },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser/posts"), { params: Promise.resolve({ username: "testuser" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("returns liked posts when tab=likes", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.like.findMany.mockResolvedValue([
      { post: { id: 5, title: "Liked Post" } },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser/posts?tab=likes"), { params: Promise.resolve({ username: "testuser" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Liked Post");
  });

  it("returns bookmarked posts when tab=bookmarks", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.bookmarkItem.findMany.mockResolvedValue([
      { post: { id: 10, title: "Bookmarked Post" } },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser/posts?tab=bookmarks"), { params: Promise.resolve({ username: "testuser" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Bookmarked Post");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser/posts"), { params: Promise.resolve({ username: "testuser" }) });
    expect(res.status).toBe(500);
  });
});
