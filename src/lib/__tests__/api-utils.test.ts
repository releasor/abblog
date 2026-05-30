import { requireId, invalidIdResponse, getErrorMessage } from "../api-utils";

describe("requireId", () => {
  it("returns number for valid numeric string", () => {
    expect(requireId("42")).toBe(42);
    expect(requireId("1")).toBe(1);
    expect(requireId("999")).toBe(999);
  });

  it("throws for non-numeric string", () => {
    expect(() => requireId("abc")).toThrow("无效ID");
    expect(() => requireId("")).toThrow("无效ID");
  });

  it("throws for NaN", () => {
    expect(() => requireId("NaN")).toThrow("无效ID");
  });

  it("throws for zero and negative numbers", () => {
    expect(() => requireId("0")).toThrow("无效ID");
    expect(() => requireId("-1")).toThrow("无效ID");
    expect(() => requireId("-999")).toThrow("无效ID");
  });
});

describe("invalidIdResponse", () => {
  it("returns 400 response with error message", async () => {
    const response = invalidIdResponse();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "无效ID" });
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("returns string as-is", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("returns default for unknown types", () => {
    expect(getErrorMessage(null)).toBe("未知错误");
    expect(getErrorMessage(undefined)).toBe("未知错误");
    expect(getErrorMessage(42)).toBe("未知错误");
    expect(getErrorMessage({})).toBe("未知错误");
  });
});
