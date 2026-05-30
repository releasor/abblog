import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
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
  category: {
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

describe("GET /api/categories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns categories with post counts", async () => {
    const mockCategories = [
      { id: 1, name: "Tech", slug: "tech", _count: { posts: 5 } },
      { id: 2, name: "Life", slug: "life", _count: { posts: 3 } },
    ];
    mockPrisma.category.findMany.mockResolvedValue(mockCategories);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockCategories);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.category.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取分类列表失败");
  });
});

describe("POST /api/categories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockGetAuthUserId.mockReturnValue(null);

    const req = makeRequest("http://localhost:3000/api/categories", {
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

    const req = makeRequest("http://localhost:3000/api/categories", {
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

    const req = makeRequest("http://localhost:3000/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("名称需要1-50个字符");
  });

  it("returns 409 for duplicate category", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findFirst.mockResolvedValue({ id: 1, name: "Tech", slug: "tech" });

    const req = makeRequest("http://localhost:3000/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "Tech" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("该分类已存在");
  });

  it("creates category successfully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 1 } });
    mockGetAuthUserId.mockReturnValue(1);
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.category.create.mockResolvedValue({
      id: 1,
      name: "New Category",
      slug: "new-category",
      _count: { posts: 0 },
    });

    const req = makeRequest("http://localhost:3000/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "New Category" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("New Category");
    expect(data.slug).toBe("new-category");
  });
});
