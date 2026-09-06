import { useMemo, useState } from 'react';

export type ListFilterFn<T> = (item: T, query: string) => boolean;
export type ListSortFn<T> = (a: T, b: T) => number;

export function filterItems<T>(items: T[], query: string, match: ListFilterFn<T>): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => match(item, q));
}

export function sortItems<T>(items: T[], compare: ListSortFn<T> | null): T[] {
  if (!compare) return items;
  return [...items].sort(compare);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const size = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size) || 1);
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

/**
 * Up to `windowSize` consecutive page numbers centered on the current page
 * (e.g. Previous · 4 5 6 · Next when on page 5).
 */
export function visiblePageNumbers(page: number, pageCount: number, windowSize = 3): number[] {
  if (pageCount <= 0) return [];
  const size = Math.max(1, Math.min(windowSize, pageCount));
  let start = Math.max(1, page - Math.floor((size - 1) / 2));
  let end = start + size - 1;
  if (end > pageCount) {
    end = pageCount;
    start = Math.max(1, end - size + 1);
  }
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

/** Shared filter + sort + pagination for large client lists. */
export function useFilteredPagination<T>(
  items: T[],
  match: ListFilterFn<T>,
  options?: {
    initialPageSize?: number;
    compare?: ListSortFn<T> | null;
  },
) {
  const initialPageSize = options?.initialPageSize ?? 12;
  const compare = options?.compare ?? null;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => filterItems(items, query, match), [items, query, match]);
  const sorted = useMemo(() => sortItems(filtered, compare), [filtered, compare]);

  const pageResult = useMemo(
    () => paginateItems(sorted, page, pageSize),
    [sorted, page, pageSize],
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
    startIndex: pageResult.startIndex,
    pageNumbers: visiblePageNumbers(pageResult.page, pageResult.pageCount, 3),
  };
}
