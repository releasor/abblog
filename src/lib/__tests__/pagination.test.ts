import { parsePagination, paginationMeta } from "../pagination";

describe("parsePagination", () => {
  function params(q: string) {
    return new URLSearchParams(q);
  }

  it("returns defaults when no params provided", () => {
    const result = parsePagination(params(""));
    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("parses page and limit", () => {
    const result = parsePagination(params("page=3&limit=10"));
    expect(result).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it("clamps page to minimum 1", () => {
    const result = parsePagination(params("page=0"));
    expect(result.page).toBe(1);
  });

  it("clamps negative page to 1", () => {
    const result = parsePagination(params("page=-5"));
    expect(result.page).toBe(1);
  });

  it("clamps limit to maxLimit (default 50)", () => {
    const result = parsePagination(params("limit=200"));
    expect(result.limit).toBe(50);
  });

  it("clamps limit to minimum 1", () => {
    const result = parsePagination(params("limit=0"));
    expect(result.limit).toBe(1);
  });

  it("uses custom defaults", () => {
    const result = parsePagination(params(""), { page: 2, limit: 10 });
    expect(result).toEqual({ page: 2, limit: 10, skip: 10 });
  });

  it("uses custom maxLimit", () => {
    const result = parsePagination(params("limit=100"), { maxLimit: 100 });
    expect(result.limit).toBe(100);
  });

  it("handles non-numeric values gracefully", () => {
    const result = parsePagination(params("page=abc&limit=xyz"));
    expect(result.page).toBe(1); // NaN -> default 1
    expect(result.limit).toBe(20); // NaN -> default 20
  });

  it("calculates correct skip for multi-page", () => {
    const result = parsePagination(params("page=5&limit=15"));
    expect(result.skip).toBe(60);
  });
});

describe("paginationMeta", () => {
  it("returns correct metadata", () => {
    expect(paginationMeta(1, 10, 25)).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("handles exact division", () => {
    expect(paginationMeta(2, 10, 20)).toEqual({
      page: 2,
      limit: 10,
      total: 20,
      totalPages: 2,
    });
  });

  it("handles zero total", () => {
    expect(paginationMeta(1, 10, 0)).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });
});
