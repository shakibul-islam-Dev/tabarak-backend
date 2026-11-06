import { PaginationMeta } from '../interfaces/api-response.interface';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function getSkipTake(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit));

  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}
