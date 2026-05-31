import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  post: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(url: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { headers });
}

describe("GET /api/cron/publish", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 401 when CRON_SECRET is set and auth header is missing", async () => {
    process.env.CRON_SECRET = "test-secret";

    const res = await GET(makeRequest("http://localhost:3000/api/cron/publish"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when auth header does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-secret";

    const res = await GET(makeRequest("http://localhost:3000/api/cron/publish", { authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("publishes scheduled posts when authorized", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 1, title: "Scheduled Post" },
      { id: 2, title: "Another Post" },
    ]);
    mockPrisma.post.updateMany.mockResolvedValue({ count: 2 });

    const res = await GET(makeRequest("http://localhost:3000/api/cron/publish", { authorization: "Bearer test-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.published).toBe(2);
    expect(mockPrisma.post.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      })
    );
  });

  it("returns 0 when no scheduled posts", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockPrisma.post.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("http://localhost:3000/api/cron/publish", { authorization: "Bearer test-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.published).toBe(0);
  });

  it("allows access when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    mockPrisma.post.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("http://localhost:3000/api/cron/publish"));
    expect(res.status).toBe(200);
  });

  it("returns 500 on database error", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/cron/publish", { authorization: "Bearer test-secret" }));
    expect(res.status).toBe(500);
  });
});
