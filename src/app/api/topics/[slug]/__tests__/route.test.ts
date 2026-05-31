import { vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    topic: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  topic: { findUnique: ReturnType<typeof vi.fn> };
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const mockTopic = {
  id: 1,
  name: "React",
  slug: "react",
  description: "React topic",
  coverImage: null,
  postCount: 5,
  posts: [
    { post: { id: 1, title: "Post 1", slug: "post-1", excerpt: null, coverImageUrl: null, publishedAt: new Date() } },
  ],
};

describe("GET /api/topics/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns topic with posts", async () => {
    mockPrisma.topic.findUnique.mockResolvedValue(mockTopic);

    const res = await GET(makeRequest("http://localhost:3000/api/topics/react"), { params: Promise.resolve({ slug: "react" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("React");
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].title).toBe("Post 1");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns 404 when topic not found", async () => {
    mockPrisma.topic.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/topics/nonexistent"), { params: Promise.resolve({ slug: "nonexistent" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("话题不存在");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.topic.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("http://localhost:3000/api/topics/react"), { params: Promise.resolve({ slug: "react" }) });
    expect(res.status).toBe(500);
  });
});
