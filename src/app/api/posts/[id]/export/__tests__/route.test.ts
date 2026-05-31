import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  post: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetAuthUserId = getAuthUserId as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const mockPost = {
  title: "Test Post",
  content: "Hello world",
  excerpt: "A test post",
  publishedAt: new Date("2024-01-15"),
  author: { name: "Author" },
};

describe("GET /api/posts/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/export"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when post not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/999/export"), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("exports post as markdown", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(mockPost);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/export?format=markdown"), { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain('title: "Test Post"');
    expect(text).toContain("Hello world");
  });

  it("returns 400 for unsupported format", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(mockPost);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/export?format=pdf"), { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("不支持的格式");
  });

  it("defaults to markdown format", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockResolvedValue(mockPost);

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/export"), { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
  });

  it("returns 500 on database error", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.post.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/posts/1/export"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(500);
  });
});
