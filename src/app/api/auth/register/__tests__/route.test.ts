import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("$2b$10$hashedpassword"),
}));

// Mock rate limit
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
  RATE_LIMITS: { auth: { windowMs: 900000, max: 10 } },
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
}));

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeRequest(body: string) {
  return new NextRequest(new URL("http://localhost:3000/api/auth/register"), {
    method: "POST",
    body,
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest(JSON.stringify({ email: "test@test.com", password: "123456", name: "Test" })));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("频繁");
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest("invalid json"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请求格式无效");
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(makeRequest(JSON.stringify({ password: "123456", name: "Test" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("邮箱");
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: "not-an-email", password: "123456", name: "Test" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("邮箱");
  });

  it("returns 400 for short password", async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: "test@test.com", password: "12345", name: "Test" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("密码");
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: "test@test.com", password: "123456" })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("昵称");
  });

  it("returns 400 for name too long", async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: "test@test.com", password: "123456", name: "a".repeat(31) })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("30");
  });

  it("returns 409 for existing email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: "test@test.com" });

    const res = await POST(makeRequest(JSON.stringify({ email: "test@test.com", password: "123456", name: "Test" })));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("已");
  });

  it("creates user successfully", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
    });

    const res = await POST(makeRequest(JSON.stringify({ email: "test@test.com", password: "123456", name: "Test User" })));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("注册成功");
    expect(data.user.email).toBe("test@test.com");
  });
});
