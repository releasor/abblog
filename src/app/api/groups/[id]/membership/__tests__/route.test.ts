import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: { findUnique: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireId: vi.fn((id: string) => {
    const num = parseInt(id);
    if (isNaN(num) || num <= 0) throw new Error("Invalid ID");
    return num;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  groupMember: { findUnique: ReturnType<typeof vi.fn> };
};
const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/groups/[id]/membership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns isMember false for unauthenticated users", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/groups/1/membership");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isMember).toBe(false);
  });

  it("returns isMember true when user is a member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue("user1");
    mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 1, groupId: 1, userId: "user1" });

    const req = makeRequest("http://localhost:3000/api/groups/1/membership");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isMember).toBe(true);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns isMember false when user is not a member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue("user1");
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/groups/1/membership");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isMember).toBe(false);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue("user1");
    mockPrisma.groupMember.findUnique.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/groups/1/membership");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(500);
  });
});
