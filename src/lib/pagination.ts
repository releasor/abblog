export function parsePagination(searchParams: URLSearchParams, defaults?: { page?: number; limit?: number; maxLimit?: number }) {
  const page = Math.max(1, parseInt(searchParams.get("page") || String(defaults?.page ?? 1)));
  const rawLimit = parseInt(searchParams.get("limit") || String(defaults?.limit ?? 20));
  const maxLimit = defaults?.maxLimit ?? 50;
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
