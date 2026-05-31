import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/pagination", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pagination")>();
  return { ...actual };
});

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  activity: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns activities with pagination", async () => {
    const mockActivities = [
      { id: 1, type: "POST_PUBLISHED", userId: 1, user: { id: 1, name: "Test", username: "test", avatar: null } },
    ];
    mockPrisma.activity.findMany.mockResolvedValue(mockActivities);
    mockPrisma.activity.count.mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/activities?page=1&limit=20"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activities).toEqual(mockActivities);
    expect(data.pagination.total).toBe(1);
  });

  it("filters by userId when provided", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activity.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/activities?userId=5"));

    expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 5 } })
    );
  });

  it("returns all activities when userId is invalid", async () => {
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activity.count.mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/activities?userId=abc"));

    expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.activity.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/activities"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取动态列表失败");
  });
});
