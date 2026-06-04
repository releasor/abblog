import { extractHeadings, injectHeadingIds, countWords } from "../toc";

describe("extractHeadings", () => {
  it("extracts h2 and h3 headings", () => {
    const html = '<h2>First</h2><p>text</p><h3>Second</h3>';
    const headings = extractHeadings(html);
    expect(headings).toHaveLength(2);
    expect(headings[0]).toEqual({ level: 2, text: "First", id: "first" });
    expect(headings[1]).toEqual({ level: 3, text: "Second", id: "second" });
  });

  it("returns empty array when no headings", () => {
    expect(extractHeadings("<p>no headings here</p>")).toEqual([]);
  });

  it("strips inner HTML from heading text", () => {
    const html = '<h2><strong>Bold</strong> Title</h2>';
    const headings = extractHeadings(html);
    expect(headings[0]?.text).toBe("Bold Title");
  });

  it("skips empty headings", () => {
    const html = "<h2></h2><h3>  </h3><h2>Valid</h2>";
    const headings = extractHeadings(html);
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Valid");
  });
});

describe("injectHeadingIds", () => {
  it("adds id to headings without id", () => {
    const html = "<h2>Hello World</h2>";
    const result = injectHeadingIds(html);
    expect(result).toContain('id="hello-world"');
  });

  it("does not modify headings that already have id", () => {
    const html = '<h2 id="custom">Hello</h2>';
    const result = injectHeadingIds(html);
    expect(result).toBe(html);
  });

  it("handles h3 headings", () => {
    const html = "<h3>Sub heading</h3>";
    const result = injectHeadingIds(html);
    expect(result).toContain('id="sub-heading"');
  });
});

describe("countWords", () => {
  it("counts words in plain text", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("strips HTML before counting", () => {
    expect(countWords("<p>hello <strong>world</strong></p>")).toBe(2);
  });

  it("returns 0 for empty content", () => {
    expect(countWords("")).toBe(0);
  });
});
