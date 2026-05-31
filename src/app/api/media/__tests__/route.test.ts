import { vi } from "vitest";
import { GET } from "../route";

vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

import { readdir, stat } from "fs/promises";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockStat = stat as unknown as ReturnType<typeof vi.fn>;
const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

describe("GET /api/media", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated users", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns media files for authenticated users", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue("user1");
    mockReaddir.mockResolvedValue(["photo.jpg", "video.mp4", "doc.txt"]);
    mockStat.mockResolvedValue({ size: 1024, birthtime: new Date("2026-01-01") });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2); // only media files
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns 500 on filesystem error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue("user1");
    mockReaddir.mockRejectedValue(new Error("FS error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
