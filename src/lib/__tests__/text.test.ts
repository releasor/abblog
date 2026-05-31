import { truncate, stripHtml } from "../text";

describe("truncate", () => {
  it("returns text unchanged if shorter than max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates at word boundary", () => {
    const result = truncate("hello world foo bar", 14);
    expect(result).toBe("hello world...");
    expect(result.length).toBeLessThanOrEqual(17); // 14 + "..."
  });

  it("truncates hard if no word boundary found", () => {
    const result = truncate("helloworld", 5);
    expect(result).toBe("hello...");
  });

  it("returns exact length text unchanged", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });
});

describe("stripHtml", () => {
  it("strips HTML tags", () => {
    expect(stripHtml("<p>hello</p>")).toBe("hello");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<div><strong>bold</strong> text</div>")).toBe("bold text");
  });

  it("normalizes whitespace", () => {
    expect(stripHtml("<p>hello</p>  <p>world</p>")).toBe("hello world");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});
