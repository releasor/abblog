import { vi } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/points", () => ({
  getLevelName: vi.fn((level: number) => `Level ${level}`),
  getProgressToNextLevel: vi.fn(() => ({ current: 50, next: 100, progress: 50 })),
  LEVELS: [
    { level: 1, name: "新手", minPoints: 0 },
    { level: 2, name: "入门", minPoints: 100 },
  ],
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

describe("GET /api/user/points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns 404 when user not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("用户不存在");
  });

  it("returns user points and level info", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ points: 50, level: 1 });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.points).toBe(50);
    expect(data.level).toBe(1);
    expect(data.levelName).toBe("Level 1");
    expect(data.progress).toEqual({ current: 50, next: 100, progress: 50 });
    expect(data.allLevels).toHaveLength(2);
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取积分信息失败");
  });
});
