import { estimateReadingTime } from "../reading-time";

describe("estimateReadingTime", () => {
  it("returns 1 for empty content", () => {
    expect(estimateReadingTime("")).toBe(1);
  });

  it("returns 1 for very short content", () => {
    expect(estimateReadingTime("<p>Hello world</p>")).toBe(1);
  });

  it("strips HTML tags before counting", () => {
    const html = "<p>" + "word ".repeat(200) + "</p>";
    expect(estimateReadingTime(html)).toBe(1);
  });

  it("calculates reading time for longer content", () => {
    const text = "word ".repeat(400);
    expect(estimateReadingTime(text)).toBe(2);
  });

  it("handles content with multiple HTML tags", () => {
    const html = "<div><p>" + "word ".repeat(600) + "</p></div>";
    expect(estimateReadingTime(html)).toBe(3);
  });

  it("rounds up reading time", () => {
    const text = "word ".repeat(201);
    expect(estimateReadingTime(text)).toBe(2);
  });
});
