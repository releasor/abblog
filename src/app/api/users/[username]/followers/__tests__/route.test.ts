import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  follow: { findMany: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/users/[username]/followers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns followers list", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.follow.findMany.mockResolvedValue([
      { follower: { id: 2, name: "Follower1", username: "follower1", avatar: null, bio: null } },
      { follower: { id: 3, name: "Follower2", username: "follower2", avatar: null, bio: "Hi" } },
    ]);

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser/followers"), { params: Promise.resolve({ username: "testuser" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].username).toBe("follower1");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/users/nobody/followers"), { params: Promise.resolve({ username: "nobody" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("用户不存在");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/users/testuser/followers"), { params: Promise.resolve({ username: "testuser" }) });
    expect(res.status).toBe(500);
  });
});
