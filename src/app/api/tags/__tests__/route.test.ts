import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
  getAuthUserId: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthUserId } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  tag: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
  };
};

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetAuthUserId = getAuthUserId as jest.MockedFunction<typeof getAuthUserId>;

function makeRequest(url: string, options?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/tags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns tags with post counts", async () => {
    const mockTags = [
      { id: 1, name: "React", slug: "react", _count: { posts: 10 } },
      { id: 2, name: "TypeScript", slug: "typescript", _count: { posts: 7 } },
    ];
    mockPrisma.tag.findMany.mockResolvedValue(mockTags);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockTags);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.tag.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取标签列表失败");
  });
});

describe("POST /api/tags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: "invalid json",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请求格式无效");
  });

  it("returns 400 for empty name", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("名称需要1-50个字符");
  });

  it("returns 400 for name exceeding 50 characters", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);

    const req = makeRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "a".repeat(51) }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("名称需要1-50个字符");
  });

  it("returns existing tag if name already exists", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findFirst.mockResolvedValue({ id: 1, name: "React", slug: "react", _count: { posts: 5 } });

    const req = makeRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "React" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("React");
  });

  it("creates tag successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.tag.findFirst.mockResolvedValue(null);
    mockPrisma.tag.create.mockResolvedValue({
      id: 3,
      name: "Next.js",
      slug: "nextjs",
      _count: { posts: 0 },
    });

    const req = makeRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "Next.js" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Next.js");
    expect(data.slug).toBe("nextjs");
  });
});
