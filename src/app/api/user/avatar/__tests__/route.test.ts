import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { upload: { window: 60000, max: 10 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { user: { update: ReturnType<typeof vi.fn> } };

function makeRequest(formData: FormData) {
  return new NextRequest(new URL("http://localhost:3000/api/user/avatar"), {
    method: "POST",
    body: formData,
  });
}

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("POST /api/user/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("returns 401 for unauthenticated users", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const fd = new FormData();
    fd.append("file", makeFile("avatar.jpg", "image/jpeg", 1000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const fd = new FormData();
    fd.append("file", makeFile("avatar.jpg", "image/jpeg", 1000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(429);
  });

  it("returns 400 when no file provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported file types", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("avatar.txt", "text/plain", 100));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("仅支持");
  });

  it("returns 400 for files over 2MB", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("big.jpg", "image/jpeg", 3 * 1024 * 1024));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("2MB");
  });

  it("uploads avatar and updates user record", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("avatar.jpg", "image/jpeg", 1000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.avatar).toMatch(/^\/uploads\/avatars\/avatar-1-.*\.jpg$/);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { avatar: expect.stringMatching(/^\/uploads\/avatars\//) },
    });
  });
});
