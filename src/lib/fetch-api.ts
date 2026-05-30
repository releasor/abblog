import { showToast } from "@/components/toast";

interface FetchOptions extends RequestInit {
  /** Toast message on success */
  successMessage?: string;
  /** Toast message on error (defaults to server error or "操作失败") */
  errorMessage?: string;
  /** Whether to show error toast (default: true) */
  showErrorToast?: boolean;
}

/**
 * Wrapper around fetch that handles common patterns:
 * - Parses JSON response
 * - Shows error toasts on failure
 * - Throws on network errors with toast notification
 */
export async function fetchApi<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const { successMessage, errorMessage, showErrorToast = true, ...fetchOptions } = options;

  try {
    const res = await fetch(url, fetchOptions);

    if (res.ok) {
      const data = await res.json() as T;
      if (successMessage) showToast(successMessage, "success");
      return { ok: true, data };
    }

    let error: string;
    try {
      const body = await res.json();
      error = body.error || errorMessage || "操作失败";
    } catch {
      error = errorMessage || "操作失败";
    }

    if (showErrorToast) showToast(error, "error");
    return { ok: false, error };
  } catch {
    const error = errorMessage || "网络错误，请稍后再试";
    if (showErrorToast) showToast(error, "error");
    return { ok: false, error };
  }
}
