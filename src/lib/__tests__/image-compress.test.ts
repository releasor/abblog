import { shouldCompress, getCompressFormat } from "../image-compress";

describe("shouldCompress", () => {
  it("returns true for JPEG", () => {
    expect(shouldCompress("image/jpeg")).toBe(true);
  });

  it("returns true for PNG", () => {
    expect(shouldCompress("image/png")).toBe(true);
  });

  it("returns true for GIF", () => {
    expect(shouldCompress("image/gif")).toBe(true);
  });

  it("returns true for WebP", () => {
    expect(shouldCompress("image/webp")).toBe(true);
  });

  it("returns false for video types", () => {
    expect(shouldCompress("video/mp4")).toBe(false);
    expect(shouldCompress("video/webm")).toBe(false);
  });

  it("returns false for unknown types", () => {
    expect(shouldCompress("application/pdf")).toBe(false);
    expect(shouldCompress("text/plain")).toBe(false);
  });
});

describe("getCompressFormat", () => {
  it("returns matching format for known types", () => {
    expect(getCompressFormat("image/jpeg")).toBe("jpeg");
    expect(getCompressFormat("image/png")).toBe("png");
  });

  it("defaults to webp for unknown types", () => {
    expect(getCompressFormat("image/gif")).toBe("webp");
    expect(getCompressFormat("image/webp")).toBe("webp");
  });
});
