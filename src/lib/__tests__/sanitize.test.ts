jest.mock("isomorphic-dompurify", () => ({
  sanitize: (html: string) => {
    // Simple mock that strips script tags and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "");
  },
}));

import { sanitizeHtml } from "../sanitize";

describe("sanitizeHtml", () => {
  it("allows safe HTML tags", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows headings", () => {
    const html = "<h1>Title</h1><h2>Subtitle</h2>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows links with href", () => {
    const html = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(html)).toContain("href");
    expect(sanitizeHtml(html)).toContain("Link");
  });

  it("allows images with src and alt", () => {
    const html = '<img src="test.jpg" alt="Test">';
    expect(sanitizeHtml(html)).toContain("src");
    expect(sanitizeHtml(html)).toContain("alt");
  });

  it("removes script tags", () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("script");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes event handlers", () => {
    const html = '<p onclick="alert(\'xss\')">Click me</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("onclick");
  });

  it("removes dangerous tags like script", () => {
    const html = '<script>alert("xss")</script>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("script");
  });

  it("allows code blocks", () => {
    const html = "<pre><code>const x = 1;</code></pre>";
    expect(sanitizeHtml(html)).toContain("pre");
    expect(sanitizeHtml(html)).toContain("code");
  });

  it("allows tables", () => {
    const html = "<table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>";
    expect(sanitizeHtml(html)).toContain("table");
    expect(sanitizeHtml(html)).toContain("th");
    expect(sanitizeHtml(html)).toContain("td");
  });

  it("allows blockquotes", () => {
    const html = "<blockquote><p>Quote</p></blockquote>";
    expect(sanitizeHtml(html)).toContain("blockquote");
  });

  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("preserves class attributes", () => {
    const html = '<p class="test">Text</p>';
    expect(sanitizeHtml(html)).toContain('class="test"');
  });
});
