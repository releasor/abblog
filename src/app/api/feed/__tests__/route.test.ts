import { vi } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/site-url", () => ({
  absoluteUrl: (path: string) => `https://example.com${path}`,
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  post: { findMany: ReturnType<typeof vi.fn> };
};

describe("GET /api/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid RSS XML", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        title: "Test Post",
        slug: "test-post",
        excerpt: "A test excerpt",
        publishedAt: new Date("2025-01-15"),
        author: { name: "Author" },
        category: { name: "Tech" },
      },
    ]);

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    expect(text).toContain('<?xml version="1.0"');
    expect(text).toContain("<title><![CDATA[Test Post]]></title>");
    expect(text).toContain("<guid isPermaLink=\"true\">https://example.com/posts/test-post</guid>");
    expect(text).toContain("<category><![CDATA[Tech]]></category>");
    expect(text).toContain("billionaire");
  });

  it("handles posts without category", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        title: "No Category",
        slug: "no-cat",
        excerpt: null,
        publishedAt: new Date("2025-01-15"),
        author: { name: "Author" },
        category: null,
      },
    ]);

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain("No Category");
    expect(text).not.toContain("<category>");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();

    expect(res.status).toBe(500);
  });

  it("sets Cache-Control header", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    const res = await GET();

    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});
