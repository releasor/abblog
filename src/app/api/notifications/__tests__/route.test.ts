import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
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
  notification: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(url: string, init?: RequestInit) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
}

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns notifications and unread count", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const mockNotifications = [
      { id: 1, userId: 1, type: "COMMENT", isRead: false, createdAt: new Date() },
      { id: 2, userId: 1, type: "LIKE", isRead: true, createdAt: new Date() },
    ];
    mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
    mockPrisma.notification.count.mockResolvedValue(1);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notifications).toHaveLength(2);
    expect(data.unreadCount).toBe(1);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 }, take: 50 })
    );
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.notification.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(401);
  });

  it("marks all notifications as read when no id provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isRead: false },
      data: { isRead: true },
    });
  });

  it("marks specific notification as read when id provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ id: 5 }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(res.status).toBe(200);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
      data: { isRead: true },
    });
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(400);
  });
});
