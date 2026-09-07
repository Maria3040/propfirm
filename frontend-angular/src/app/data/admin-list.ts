export type AdminPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortBy: string;
  sortDir: 'asc' | 'desc' | string;
  q: string | null;
  filters: Record<string, unknown>;
};

export type AdminListParams = {
  page: number;
  pageSize: number;
  q: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  filters: Record<string, string>;
};

export function emptyAdminPage<T>(partial?: Partial<AdminPage<T>>): AdminPage<T> {
  return {
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    sortBy: 'createdAt',
    sortDir: 'desc',
    q: null,
    filters: {},
    ...partial,
  };
}

/** Normalize envelope or legacy bare arrays from older backends. */
export function normalizeAdminPage<T>(
  raw: unknown,
  fallback?: Partial<AdminPage<T>>,
): AdminPage<T> {
  const base = emptyAdminPage<T>(fallback);
  if (Array.isArray(raw)) {
    return {
      ...base,
      items: raw as T[],
      total: raw.length,
      totalPages: 1,
      page: 1,
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const items = Array.isArray(o['items']) ? (o['items'] as T[]) : [];
    const pageSize = Number(o['pageSize']) || base.pageSize;
    const total = Number(o['total'] ?? items.length) || 0;
    return {
      items,
      page: Number(o['page']) || 1,
      pageSize,
      total,
      totalPages: Number(o['totalPages']) || Math.max(1, Math.ceil(total / pageSize) || 1),
      sortBy: typeof o['sortBy'] === 'string' ? o['sortBy'] : base.sortBy,
      sortDir: typeof o['sortDir'] === 'string' ? o['sortDir'] : base.sortDir,
      q: typeof o['q'] === 'string' ? o['q'] : o['q'] === null ? null : base.q,
      filters:
        o['filters'] && typeof o['filters'] === 'object' && !Array.isArray(o['filters'])
          ? (o['filters'] as Record<string, unknown>)
          : {},
    };
  }
  return base;
}

export function buildListQuery(params: AdminListParams): string {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  sp.set('pageSize', String(params.pageSize));
  if (params.q.trim()) sp.set('q', params.q.trim());
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortDir) sp.set('sortDir', params.sortDir);
  for (const [k, v] of Object.entries(params.filters)) {
    if (v) sp.set(k, v);
  }
  return sp.toString();
}
