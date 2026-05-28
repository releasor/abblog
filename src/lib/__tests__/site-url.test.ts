import { getSiteUrl, absoluteUrl } from "../site-url";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("getSiteUrl", () => {
  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("returns localhost default when env not set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});

describe("absoluteUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it("handles path with leading slash", () => {
    expect(absoluteUrl("/posts/hello")).toBe("https://example.com/posts/hello");
  });

  it("handles path without leading slash", () => {
    expect(absoluteUrl("posts/hello")).toBe("https://example.com/posts/hello");
  });

  it("handles empty path", () => {
    expect(absoluteUrl("")).toBe("https://example.com/");
  });

  it("handles root path", () => {
    expect(absoluteUrl("/")).toBe("https://example.com/");
  });
});
