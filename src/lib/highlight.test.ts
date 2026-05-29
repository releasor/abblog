import { escapeHtml, highlightTerms } from "./highlight";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("'hello'")).toBe("&#039;hello&#039;");
  });

  it("escapes multiple characters", () => {
    expect(escapeHtml('<div class="test">')).toBe("&lt;div class=&quot;test&quot;&gt;");
  });
});

describe("highlightTerms", () => {
  it("wraps matching term in mark tags", () => {
    const result = highlightTerms("Hello World", "World");
    expect(result).toBe("Hello <mark>World</mark>");
  });

  it("is case insensitive", () => {
    const result = highlightTerms("Hello HELLO hello", "hello");
    expect(result).toContain("<mark>Hello</mark>");
    expect(result).toContain("<mark>HELLO</mark>");
    expect(result).toContain("<mark>hello</mark>");
  });

  it("handles multiple search words", () => {
    const result = highlightTerms("Hello World", "Hello World");
    expect(result).toBe("<mark>Hello</mark> <mark>World</mark>");
  });

  it("escapes HTML in source text", () => {
    const result = highlightTerms("<script>alert('xss')</script>", "script");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("<mark>script</mark>");
  });

  it("escapes regex special characters in query", () => {
    const result = highlightTerms("Price is $100 (USD)", "$100");
    expect(result).toContain("<mark>$100</mark>");
  });
});
