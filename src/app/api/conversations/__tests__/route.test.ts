import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationMember: {
      findMany: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/api-utils", () => ({
  requireId: vi.fn((id: string) => {
    const n = parseInt(id, 10);
    if (isNaN(n)) throw new Error("invalid");
    return n;
  }),
  invalidIdResponse: vi.fn(() => new Response(JSON.stringify({ error: "无效的 ID" }), { status: 400 })),
}));

import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  conversationMember: { findMany: ReturnType<typeof vi.fn> };
  conversation: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string, init?: RequestInit) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
}

describe("GET /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns conversations with last message", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const mockMemberships = [
      {
        conversation: {
          id: 1,
          updatedAt: new Date(),
          members: [{ user: { id: 2, name: "Bob", username: "bob", avatar: null } }],
          messages: [{ id: 1, content: "Hello", sender: { id: 2, name: "Bob" }, createdAt: new Date() }],
        },
        lastReadAt: new Date(),
      },
    ];
    mockPrisma.conversationMember.findMany.mockResolvedValue(mockMemberships);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].otherUser.name).toBe("Bob");
    expect(data[0].lastMessage.content).toBe("Hello");
  });
});

describe("POST /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await POST(makeRequest("http://localhost:3000/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "2" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when targeting self", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await POST(makeRequest("http://localhost:3000/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "1" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("自己");
  });

  it("returns existing conversation if found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    mockPrisma.conversation.findFirst.mockResolvedValue({ id: 10 });

    const res = await POST(makeRequest("http://localhost:3000/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "2" }),
      headers: { "Content-Type": "application/json" },
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe(10);
    expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
  });

  it("creates new conversation when none exists", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    mockPrisma.conversation.findFirst.mockResolvedValue(null);
    mockPrisma.conversation.create.mockResolvedValue({ id: 20 });

    const res = await POST(makeRequest("http://localhost:3000/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "2" }),
      headers: { "Content-Type": "application/json" },
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe(20);
    expect(mockPrisma.conversation.create).toHaveBeenCalled();
  });
});
