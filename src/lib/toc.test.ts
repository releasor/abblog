import { extractHeadings, injectHeadingIds, countWords } from "./toc";

describe("extractHeadings", () => {
  it("extracts h2 and h3 headings", () => {
    const html = `
      <h2>Introduction</h2>
      <p>Some text</p>
      <h3>Getting Started</h3>
      <h2>Conclusion</h3>
    `;
    const result = extractHeadings(html);
    expect(result).toEqual([
      { level: 2, text: "Introduction", id: "introduction" },
      { level: 3, text: "Getting Started", id: "getting-started" },
      { level: 2, text: "Conclusion", id: "conclusion" },
    ]);
  });

  it("ignores h1 and h4 headings", () => {
    const html = `<h1>Title</h1><h2>Section</h2><h4>Subsection</h4>`;
    const result = extractHeadings(html);
    expect(result).toEqual([{ level: 2, text: "Section", id: "section" }]);
  });

  it("strips inner HTML from heading text", () => {
    const html = `<h2><strong>Bold</strong> Heading</h2>`;
    const result = extractHeadings(html);
    expect(result).toEqual([{ level: 2, text: "Bold Heading", id: "bold-heading" }]);
  });

  it("skips empty headings", () => {
    const html = `<h2></h2><h2>   </h2><h2>Valid</h2>`;
    const result = extractHeadings(html);
    expect(result).toEqual([{ level: 2, text: "Valid", id: "valid" }]);
  });

  it("returns empty array for no headings", () => {
    const html = `<p>No headings here</p>`;
    expect(extractHeadings(html)).toEqual([]);
  });

  it("handles special characters in headings", () => {
    const html = `<h2>What's New?</h2>`;
    const result = extractHeadings(html);
    expect(result[0].id).toBe("whats-new");
  });
});

describe("injectHeadingIds", () => {
  it("adds id attributes to h2 and h3 without ids", () => {
    const html = `<h2>Hello World</h2><h3>Sub Section</h3>`;
    const result = injectHeadingIds(html);
    expect(result).toBe(`<h2 id="hello-world">Hello World</h2><h3 id="sub-section">Sub Section</h3>`);
  });

  it("preserves existing id attributes", () => {
    const html = `<h2 id="custom-id">Hello</h2>`;
    const result = injectHeadingIds(html);
    expect(result).toBe(`<h2 id="custom-id">Hello</h2>`);
  });

  it("handles headings with other attributes", () => {
    const html = `<h2 class="title">Hello</h2>`;
    const result = injectHeadingIds(html);
    expect(result).toBe(`<h2 class="title" id="hello">Hello</h2>`);
  });

  it("skips empty headings", () => {
    const html = `<h2></h2>`;
    const result = injectHeadingIds(html);
    expect(result).toBe(`<h2></h2>`);
  });

  it("does not modify h1 or h4", () => {
    const html = `<h1>Title</h1><h4>Sub</h4>`;
    const result = injectHeadingIds(html);
    expect(result).toBe(`<h1>Title</h1><h4>Sub</h4>`);
  });

  it("round-trips with extractHeadings", () => {
    const html = `<h2>First</h2><p>text</p><h3>Second</h3>`;
    const injected = injectHeadingIds(html);
    const headings = extractHeadings(injected);
    expect(headings).toEqual([
      { level: 2, text: "First", id: "first" },
      { level: 3, text: "Second", id: "second" },
    ]);
  });
});

describe("countWords", () => {
  it("counts words in HTML content", () => {
    const html = `<p>Hello world this is a test</p>`;
    expect(countWords(html)).toBe(6);
  });

  it("strips HTML tags before counting", () => {
    const html = `<h2><strong>Hello</strong> world</h2> <p>One two three</p>`;
    expect(countWords(html)).toBe(5);
  });

  it("returns 0 for empty content", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("<p></p>")).toBe(0);
  });

  it("handles multiple spaces", () => {
    const html = `<p>   hello    world   </p>`;
    expect(countWords(html)).toBe(2);
  });
});
