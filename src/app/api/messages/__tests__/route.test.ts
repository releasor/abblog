import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    message: {
      findMany: vi.fn(),
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

vi.mock("@/lib/api-utils", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  message: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns messages list", async () => {
    const mockMessages = [
      { id: 1, name: "Alice", content: "Hello", createdAt: new Date(), user: { name: "Alice" } },
      { id: 2, name: "Bob", content: "Hi", createdAt: new Date(), user: null },
    ];
    mockPrisma.message.findMany.mockResolvedValue(mockMessages);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Alice");
    expect(data[1].name).toBe("Bob");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.message.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取留言列表失败");
  });
});

describe("POST /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows anonymous messages with default name", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);
    mockPrisma.message.create.mockResolvedValue({
      id: 1,
      content: "Hello",
      name: "匿名用户",
      createdAt: new Date(),
    });

    const req = makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("匿名用户");
  });

  it("returns 400 for empty content", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "Alice" } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请输入留言内容");
  });

  it("returns 400 for content exceeding 500 chars", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "Alice" } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body: JSON.stringify({ content: "a".repeat(501) }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("留言不能超过500字");
  });

  it("creates message successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "Alice" } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.message.create.mockResolvedValue({
      id: 1,
      content: "Hello",
      name: "Alice",
      createdAt: new Date(),
    });

    const req = makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.content).toBe("Hello");
    expect(data.name).toBe("Alice");
  });

  it("truncates name to 50 chars", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "A".repeat(60) } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.message.create.mockResolvedValue({
      id: 1,
      content: "Hello",
      name: "A".repeat(50),
      createdAt: new Date(),
    });

    const req = makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toHaveLength(50);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1, name: "Alice" } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.message.create.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("发送失败，请稍后重试");
  });
});
