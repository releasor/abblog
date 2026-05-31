import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationMember: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn() },
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
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0) throw new Error("Invalid ID");
    return num;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的ID" }), { status: 400 })),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  conversationMember: { findUnique: ReturnType<typeof vi.fn> };
  conversation: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/conversations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not a member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when conversation not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/999"), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("returns conversation with other user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      members: [{ user: { id: 2, name: "Other", username: "other", avatar: null } }],
    });

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.otherUser.name).toBe("Other");
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
