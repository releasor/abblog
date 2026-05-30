export function parsePagination(searchParams: URLSearchParams, defaults?: { page?: number; limit?: number; maxLimit?: number }) {
  const rawPage = parseInt(searchParams.get("page") || "");
  const page = Math.max(1, isNaN(rawPage) ? (defaults?.page ?? 1) : rawPage);
  const rawLimit = parseInt(searchParams.get("limit") || "");
  const maxLimit = defaults?.maxLimit ?? 50;
  const limit = Math.min(maxLimit, Math.max(1, isNaN(rawLimit) ? (defaults?.limit ?? 20) : rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
