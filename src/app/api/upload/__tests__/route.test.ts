import { vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: { mediaFile: { create: vi.fn() } },
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

vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: vi.fn(() => ({ width: 100, height: 100 })) })),
}));

vi.mock("@/lib/image-compress", () => ({
  shouldCompress: vi.fn(() => false),
  compressImage: vi.fn(),
  getCompressFormat: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

function makeRequest(formData: FormData) {
  return new NextRequest(new URL("http://localhost:3000/api/upload"), {
    method: "POST",
    body: formData,
  });
}

function makeFile(name: string, type: string, size: number): File {
  const buffer = new Uint8Array(size);
  return new File([buffer], name, { type });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 401 for unauthenticated users", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const fd = new FormData();
    fd.append("file", makeFile("test.jpg", "image/jpeg", 1000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const fd = new FormData();
    fd.append("file", makeFile("test.jpg", "image/jpeg", 1000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(429);
  });

  it("returns 400 when no file provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("请选择文件");
  });

  it("returns 400 for unsupported file types", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("test.txt", "text/plain", 100));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("不支持的文件类型");
  });

  it("returns 400 for oversized images", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("big.jpg", "image/jpeg", 11 * 1024 * 1024));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("文件过大");
  });

  it("returns 400 for oversized videos", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("big.mp4", "video/mp4", 51 * 1024 * 1024));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("文件过大");
  });

  it("uploads valid image successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("photo.jpg", "image/jpeg", 1000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.url).toMatch(/^\/uploads\/.*\.jpg$/);
  });

  it("uploads valid video successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const fd = new FormData();
    fd.append("file", makeFile("clip.mp4", "video/mp4", 5000));
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.url).toMatch(/^\/uploads\/.*\.mp4$/);
  });
});
