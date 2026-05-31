import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const mockUser = {
  id: 1,
  name: "Test User",
  username: "testuser",
  avatar: null,
  bio: "A bio",
  website: "https://example.com",
  location: "Beijing",
  createdAt: "2024-01-01T00:00:00Z",
  _count: { followers: 10, following: 5, posts: 20, likes: 30 },
};

describe("GET /api/users/[username]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser"), { params: Promise.resolve({ username: "testuser" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.username).toBe("testuser");
    expect(data._count.followers).toBe(10);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/users/nobody"), { params: Promise.resolve({ username: "nobody" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("用户不存在");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser"), { params: Promise.resolve({ username: "testuser" }) });
    expect(res.status).toBe(500);
  });
});
