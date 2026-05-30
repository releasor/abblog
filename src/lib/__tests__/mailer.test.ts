import { notificationEmailTemplate } from "../mailer";

describe("notificationEmailTemplate", () => {
  it("returns HTML with title and message", () => {
    const html = notificationEmailTemplate("Test Title", "Test message");
    expect(html).toContain("Test Title");
    expect(html).toContain("Test message");
    expect(html).toContain("<h2");
    expect(html).toContain("<p");
  });

  it("includes link button when link is provided", () => {
    const html = notificationEmailTemplate("Title", "Msg", "https://example.com");
    expect(html).toContain("https://example.com");
    expect(html).toContain("<a href=");
    expect(html).toContain("查看");
  });

  it("omits link button when no link", () => {
    const html = notificationEmailTemplate("Title", "Msg");
    expect(html).not.toContain("<a href=");
  });

  it("includes brand footer", () => {
    const html = notificationEmailTemplate("Title", "Msg");
    expect(html).toContain("billionaire");
  });

  it("includes inline styles for email compatibility", () => {
    const html = notificationEmailTemplate("Title", "Msg");
    expect(html).toContain("style=");
    expect(html).toContain("font-family");
  });

  it("escapes HTML in title, message, and link to prevent XSS", () => {
    const html = notificationEmailTemplate(
      '<script>alert("xss")</script>',
      'Hello <img src=x onerror=alert(1)>',
      'javascript:alert(1)'
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("javascript:alert(1)");
  });
});
