import { vi, describe, it, expect, beforeEach } from "vitest";
import { getRelatedPosts } from "../related-posts";

vi.mock("../prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

const mockPrisma = prisma as unknown as {
  post: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe("getRelatedPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when post not found", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const result = await getRelatedPosts(1);
    expect(result).toEqual([]);
  });

  it("returns posts with shared tags sorted by score", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      categoryId: 1,
      tags: [{ tagId: 1 }, { tagId: 2 }, { tagId: 3 }],
    });
    // First call: tag-based posts (enough to fill limit, no category fallback needed)
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 2, title: "Post 2", slug: "post-2", excerpt: null, coverImageUrl: null, publishedAt: new Date("2024-01-01"), category: { name: "Tech", slug: "tech" }, tags: [{ tagId: 1 }, { tagId: 2 }] },
      { id: 3, title: "Post 3", slug: "post-3", excerpt: null, coverImageUrl: null, publishedAt: new Date("2024-01-02"), category: { name: "Tech", slug: "tech" }, tags: [{ tagId: 1 }] },
      { id: 4, title: "Post 4", slug: "post-4", excerpt: null, coverImageUrl: null, publishedAt: new Date("2024-01-03"), category: { name: "Tech", slug: "tech" }, tags: [{ tagId: 1 }] },
    ]);

    const result = await getRelatedPosts(1, 3);

    expect(result).toHaveLength(3);
    expect(result[0].score).toBe(2); // Post 2 shares 2 tags
    expect(result[1].score).toBe(1); // Post 3 shares 1 tag (sorted by date desc)
  });

  it("fills remaining slots with category posts", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      categoryId: 1,
      tags: [{ tagId: 1 }],
    });
    // First call: tag-based posts
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 2, title: "Tag Post", slug: "tag-post", excerpt: null, coverImageUrl: null, publishedAt: new Date(), category: null, tags: [{ tagId: 1 }] },
    ]);
    // Second call: category-based posts
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 3, title: "Cat Post", slug: "cat-post", excerpt: null, coverImageUrl: null, publishedAt: new Date(), category: { name: "Tech", slug: "tech" }, tags: [] },
    ]);

    const result = await getRelatedPosts(1, 3);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
    expect(result[1].score).toBe(0);
  });

  it("skips tag search when post has no tags", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      categoryId: 1,
      tags: [],
    });
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 3, title: "Cat Post", slug: "cat-post", excerpt: null, coverImageUrl: null, publishedAt: new Date(), category: { name: "Tech", slug: "tech" }, tags: [] },
    ]);

    const result = await getRelatedPosts(1, 3);

    expect(result).toHaveLength(1);
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1); // Only category query
  });

  it("returns empty when post has no tags and no category", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      categoryId: null,
      tags: [],
    });

    const result = await getRelatedPosts(1);
    expect(result).toEqual([]);
  });
});
