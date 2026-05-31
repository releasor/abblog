import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    donation: {
      findMany: vi.fn(),
      count: vi.fn(),
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
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/points", () => ({
  addPoints: vi.fn(),
  POINTS: { DONATION_RECEIVED: 10 },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, max: 100 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId, isAdmin } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  donation: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/donations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/donations"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns user donations with pagination", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(false);

    const mockDonations = [
      { id: 1, amount: 1000, donor: { id: 1, name: "A" }, recipient: { id: 2, name: "B" } },
    ];
    mockPrisma.donation.findMany.mockResolvedValue(mockDonations);
    mockPrisma.donation.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/donations?page=1&limit=10"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.donations).toEqual(mockDonations);
    expect(data.pagination.total).toBe(1);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockIsAdmin.mockReturnValue(false);
    mockPrisma.donation.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/donations"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取打赏列表失败");
  });
});

describe("POST /api/donations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/donations", {
      method: "POST",
      body: JSON.stringify({ recipientId: "2", amount: 1000 }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/donations", {
      method: "POST",
      body: "invalid",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请求格式无效");
  });

  it("returns 400 for amount below minimum", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/donations", {
      method: "POST",
      body: JSON.stringify({ recipientId: "2", amount: 50 }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("参数无效（最低1元）");
  });

  it("returns 400 for self-donation", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/donations", {
      method: "POST",
      body: JSON.stringify({ recipientId: "1", amount: 1000 }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("不能给自己打赏");
  });

  it("creates donation successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const mockDonation = { id: 1, donorId: 1, recipientId: 2, amount: 1000, message: "Thanks" };
    mockPrisma.donation.create.mockResolvedValue(mockDonation);

    const req = makeRequest("http://localhost:3000/api/donations", {
      method: "POST",
      body: JSON.stringify({ recipientId: "2", amount: 1000, message: "Thanks" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe(1);
  });
});
