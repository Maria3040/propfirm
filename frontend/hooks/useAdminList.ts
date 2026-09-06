'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  type AdminListParams,
  type AdminPage,
  buildListQuery,
  emptyAdminPage,
  normalizeAdminPage,
} from '@/lib/adminList';

type Options = {
  path: string;
  enabled?: boolean;
  defaultSortBy?: string;
  defaultSortDir?: 'asc' | 'desc';
  initialFilters?: Record<string, string>;
  pageSize?: number;
};

function parseApiError(e: unknown): string {
  if (!(e instanceof Error)) return 'Failed to load';
  const raw = e.message.trim();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === 'string') return j.detail;
  } catch {
    /* plain text */
  }
  return raw || 'Failed to load';
}

export function useAdminList<T>({
  path,
  enabled = true,
  defaultSortBy = 'createdAt',
  defaultSortDir = 'desc',
  initialFilters = {},
  pageSize = 20,
}: Options) {
  const [params, setParams] = useState<AdminListParams>({
    page: 1,
    pageSize,
    q: '',
    sortBy: defaultSortBy,
    sortDir: defaultSortDir,
    filters: initialFilters,
  });
  const [data, setData] = useState<AdminPage<T>>(
    emptyAdminPage<T>({ sortBy: defaultSortBy, sortDir: defaultSortDir, pageSize }),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [searchInput, setSearchInput] = useState(initialFilters.q || '');
  const reqSeq = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    try {
      const qs = buildListQuery(params);
      const raw = await api<unknown>(`${path}?${qs}`, { signal: ac.signal });
      if (seq !== reqSeq.current) return;
      setData(
        normalizeAdminPage<T>(raw, {
          sortBy: params.sortBy,
          sortDir: params.sortDir,
          pageSize: params.pageSize,
        }),
      );
    } catch (e: unknown) {
      if (ac.signal.aborted) return;
      if (seq !== reqSeq.current) return;
      setError(parseApiError(e));
      // Keep previous rows so pagination/search feels seamless on transient errors.
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [enabled, path, params]);

  useEffect(() => {
    void reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  const safeData: AdminPage<T> = {
    ...data,
    items: Array.isArray(data?.items) ? data.items : [],
    totalPages: Math.max(1, data?.totalPages || 1),
  };

  function setPage(page: number) {
    setParams((p) => ({ ...p, page: Math.max(1, page) }));
  }

  function setPageSize(size: number) {
    setParams((p) => ({ ...p, pageSize: size, page: 1 }));
  }

  function setFilter(key: string, value: string) {
    setParams((p) => ({
      ...p,
      page: 1,
      filters: { ...p.filters, [key]: value },
    }));
  }

  function setFilters(next: Record<string, string>) {
    setParams((p) => ({ ...p, page: 1, filters: { ...next } }));
  }

  function toggleSort(column: string) {
    setParams((p) => {
      if (p.sortBy === column) {
        return { ...p, sortDir: p.sortDir === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...p, sortBy: column, sortDir: 'asc', page: 1 };
    });
  }

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      setParams((p) => {
        if (p.q === value) return p;
        return { ...p, q: value, page: 1 };
      });
    }, 350);
  }

  return {
    data: safeData,
    params,
    loading,
    error,
    searchInput,
    reload,
    setPage,
    setPageSize,
    setFilter,
    setFilters,
    toggleSort,
    onSearchChange,
  };
}
