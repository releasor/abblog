import { slugify } from "./slugify";

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("my blog post")).toBe("my-blog-post");
  });

  it("removes special characters", () => {
    expect(slugify("Hello! @World# $%")).toBe("hello-world");
  });

  it("handles multiple spaces", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("handles multiple hyphens", () => {
    expect(slugify("hello---world")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles Chinese characters", () => {
    expect(slugify("你好世界")).toBe("");
  });

  it("handles mixed content", () => {
    expect(slugify("My Post 2024!")).toBe("my-post-2024");
  });

  it("preserves numbers", () => {
    expect(slugify("post-123")).toBe("post-123");
  });
});
