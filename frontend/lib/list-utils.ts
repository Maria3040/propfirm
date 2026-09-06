import { useMemo, useState } from 'react';

export type ListFilterFn<T> = (item: T, query: string) => boolean;

export function filterItems<T>(items: T[], query: string, match: ListFilterFn<T>): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => match(item, q));
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const size = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return {
    page: safePage,
    pageSize: size,
    pageCount,
    total,
    items: items.slice(start, start + size),
    startIndex: start,
  };
}

/** Shared filter + pagination state for large client lists (competitions, leaderboards, …). */
export function useFilteredPagination<T>(
  items: T[],
  match: ListFilterFn<T>,
  initialPageSize = 12,
) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => filterItems(items, query, match), [items, query, match]);

  const pageResult = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  function updateQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  function updatePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  return {
    query,
    setQuery: updateQuery,
    page: pageResult.page,
    setPage,
    pageSize: pageResult.pageSize,
    setPageSize: updatePageSize,
    pageCount: pageResult.pageCount,
    total: pageResult.total,
    filteredTotal: filtered.length,
    pageItems: pageResult.items,
  };
}
