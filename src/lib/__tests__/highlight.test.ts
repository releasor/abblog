import { escapeHtml, highlightTerms } from "../highlight";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("highlightTerms", () => {
  it("wraps matching terms in <mark>", () => {
    const result = highlightTerms("Hello World", "World");
    expect(result).toContain("<mark>");
    expect(result).toContain("World");
  });

  it("is case insensitive", () => {
    const result = highlightTerms("Hello World", "hello");
    expect(result).toContain("<mark>");
  });

  it("escapes HTML in text", () => {
    const result = highlightTerms("<script>alert(1)</script>", "alert");
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("<mark>");
  });

  it("escapes HTML in query", () => {
    const result = highlightTerms("hello world", "<b>world</b>");
    expect(result).not.toContain("<b>");
  });

  it("handles multiple terms", () => {
    const result = highlightTerms("Hello World Foo", "Hello Foo");
    const marks = result.match(/<mark>/g);
    expect(marks).toHaveLength(2);
  });

  it("returns original text when query is empty", () => {
    expect(highlightTerms("Hello", "")).toBe("Hello");
  });
});
