import { formatDate, formatDateShort, formatMonthDay, formatDateTime, formatRelativeTime } from "../format-date";

describe("formatDate", () => {
  it("formats a Date object", () => {
    const date = new Date(2024, 2, 15); // March 15, 2024
    const result = formatDate(date);
    expect(result).toContain("2024");
    expect(result).toContain("3");
    expect(result).toContain("15");
  });

  it("formats a date string", () => {
    const result = formatDate("2024-06-01T00:00:00Z");
    expect(result).toContain("2024");
  });

  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("formatDateShort", () => {
  it("formats date in short format", () => {
    const date = new Date(2024, 2, 15);
    const result = formatDateShort(date);
    expect(result).toBeTruthy();
  });

  it("returns empty string for null", () => {
    expect(formatDateShort(null)).toBe("");
  });
});

describe("formatMonthDay", () => {
  it("formats month and day only", () => {
    const date = new Date(2024, 2, 15);
    const result = formatMonthDay(date);
    expect(result).toBeTruthy();
    expect(result).not.toContain("2024");
  });

  it("returns empty string for null", () => {
    expect(formatMonthDay(null)).toBe("");
  });
});

describe("formatDateTime", () => {
  it("formats date with time", () => {
    const date = new Date(2024, 2, 15, 14, 30);
    const result = formatDateTime(date);
    expect(result).toContain("2024");
    expect(result).toContain("3");
    expect(result).toContain("15");
  });

  it("formats a date string with time", () => {
    const result = formatDateTime("2024-06-01T10:30:00Z");
    expect(result).toContain("2024");
  });

  it("returns empty string for null", () => {
    expect(formatDateTime(null)).toBe("");
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
    const oldDate = new Date(2020, 0, 1);
    const result = formatRelativeTime(oldDate);
    expect(result).toContain("2020");
  });

  it("accepts date strings", () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result).toBe("刚刚");
  });
});
