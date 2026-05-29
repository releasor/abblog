import { slugify } from "../slugify";

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("my blog post")).toBe("my-blog-post");
  });

  it("removes special characters", () => {
    expect(slugify("hello! @world#")).toBe("hello-world");
  });

  it("collapses multiple hyphens", () => {
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

  it("preserves numbers", () => {
    expect(slugify("post 123")).toBe("post-123");
  });

  it("handles underscores", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });

  it("handles mixed whitespace", () => {
    expect(slugify("hello\t\nworld")).toBe("hello-world");
  });

  it("handles only special characters", () => {
    expect(slugify("!@#$%^&*()")).toBe("");
  });

  it("handles very long text", () => {
    const longText = "a".repeat(300);
    expect(slugify(longText)).toBe(longText);
  });
});
