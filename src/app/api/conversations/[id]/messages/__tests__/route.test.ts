import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    directMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    conversation: {
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { comment: { windowMs: 60000, max: 10 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  conversationMember: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  directMessage: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  conversation: { update: ReturnType<typeof vi.fn> };
  notification: { create: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

const ctx = { params: Promise.resolve({ id: "1" }) };

describe("GET /api/conversations/[id]/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated users", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1/messages"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1/messages"), ctx);
    expect(res.status).toBe(403);
  });

  it("returns messages for members", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.directMessage.findMany.mockResolvedValue([
      { id: 1, content: "Hello", sender: { id: 1, name: "User", avatar: null } },
    ]);
    mockPrisma.conversationMember.update.mockResolvedValue({});

    const res = await GET(makeRequest("http://localhost:3000/api/conversations/1/messages"), ctx);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].content).toBe("Hello");
  });
});

describe("POST /api/conversations/[id]/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for empty content", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 10 });

    const req = makeRequest("http://localhost:3000/api/conversations/1/messages", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 for content exceeding 2000 chars", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 10 });

    const req = makeRequest("http://localhost:3000/api/conversations/1/messages", {
      method: "POST",
      body: JSON.stringify({ content: "a".repeat(2001) }),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("creates message and notifies other members", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "Alice" } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.directMessage.create.mockResolvedValue({
      id: 1,
      content: "Hello",
      sender: { id: 1, name: "Alice", avatar: null },
    });
    mockPrisma.conversation.update.mockResolvedValue({});
    mockPrisma.conversationMember.findMany.mockResolvedValue([{ userId: 2 }]);
    mockPrisma.notification.create.mockResolvedValue({});

    const req = makeRequest("http://localhost:3000/api/conversations/1/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    });
    const res = await POST(req, ctx);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.content).toBe("Hello");
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });
});
