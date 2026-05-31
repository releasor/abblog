import { vi } from "vitest";
import { fetchApi } from "../fetch-api";
import { showToast } from "@/components/toast";

// Mock showToast
vi.mock("@/components/toast", () => ({
  showToast: vi.fn(),
}));

const mockShowToast = showToast as ReturnType<typeof vi.fn>;

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchApi", () => {
  it("returns data on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, name: "test" }),
    });

    const result = await fetchApi("/api/test");
    expect(result).toEqual({ ok: true, data: { id: 1, name: "test" } });
  });

  it("shows success toast when successMessage provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await fetchApi("/api/test", { successMessage: "操作成功" });
    expect(mockShowToast).toHaveBeenCalledWith("操作成功", "success");
  });

  it("does not show success toast when successMessage omitted", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await fetchApi("/api/test");
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("returns error on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "服务器错误" }),
    });

    const result = await fetchApi("/api/test");
    expect(result).toEqual({ ok: false, error: "服务器错误" });
  });

  it("shows error toast on failure by default", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "请求失败" }),
    });

    await fetchApi("/api/test");
    expect(mockShowToast).toHaveBeenCalledWith("请求失败", "error");
  });

  it("uses custom errorMessage when server has no error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const result = await fetchApi("/api/test", { errorMessage: "自定义错误" });
    expect(result).toEqual({ ok: false, error: "自定义错误" });
    expect(mockShowToast).toHaveBeenCalledWith("自定义错误", "error");
  });

  it("does not show error toast when showErrorToast is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "静默错误" }),
    });

    const result = await fetchApi("/api/test", { showErrorToast: false });
    expect(result).toEqual({ ok: false, error: "静默错误" });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("handles network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchApi("/api/test");
    expect(result).toEqual({ ok: false, error: "网络错误，请稍后再试" });
    expect(mockShowToast).toHaveBeenCalledWith("网络错误，请稍后再试", "error");
  });

  it("handles non-JSON error responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => { throw new Error("not json"); },
    });

    const result = await fetchApi("/api/test", { errorMessage: "解析失败" });
    expect(result).toEqual({ ok: false, error: "解析失败" });
  });

  it("passes fetch options correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await fetchApi("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"key":"value"}',
    });
  });
});
