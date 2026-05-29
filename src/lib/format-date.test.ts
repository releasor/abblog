import { formatDate, formatDateShort, formatRelativeTime } from "./format-date";

describe("formatDate", () => {
  it("formats a Date object to Chinese locale", () => {
    const date = new Date("2024-01-15T12:00:00Z");
    const result = formatDate(date);
    expect(result).toContain("2024");
    expect(result).toContain("1");
    expect(result).toContain("15");
  });

  it("formats a date string", () => {
    const result = formatDate("2024-06-20T12:00:00Z");
    expect(result).toContain("2024");
    expect(result).toContain("6");
    expect(result).toContain("20");
  });

  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("formatDateShort", () => {
  it("formats a Date object", () => {
    const date = new Date("2024-03-10T12:00:00Z");
    const result = formatDateShort(date);
    expect(result).toContain("2024");
    expect(result).toContain("3");
    expect(result).toContain("10");
  });

  it("returns empty string for null", () => {
    expect(formatDateShort(null)).toBe("");
  });
});

describe("formatRelativeTime", () => {
  it("returns 刚刚 for recent time", () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe("刚刚");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 分钟前");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 小时前");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 天前");
  });

  it("falls back to formatDate for old dates", () => {
    const oldDate = new Date("2020-01-01T12:00:00Z");
    const result = formatRelativeTime(oldDate);
    expect(result).toContain("2020");
  });
});
