import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import {
  AdminListParams,
  AdminPage,
  buildListQuery,
  emptyAdminPage,
  normalizeAdminPage,
} from '../data/admin-list';

export type AdminListHandle<T> = {
  params: ReturnType<typeof signal<AdminListParams>>;
  data: ReturnType<typeof signal<AdminPage<T>>>;
  loading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<string>>;
  searchInput: ReturnType<typeof signal<string>>;
  reload: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setFilter: (key: string, value: string) => void;
  setFilters: (next: Record<string, string>) => void;
  toggleSort: (col: string) => void;
  onSearchChange: (value: string) => void;
};

@Injectable({ providedIn: 'root' })
export class AdminListService {
  private readonly api = inject(ApiService);

  createList<T>(opts: {
    path: string;
    defaultSortBy?: string;
    defaultSortDir?: 'asc' | 'desc';
    pageSize?: number;
    initialFilters?: Record<string, string>;
  }): AdminListHandle<T> {
    const defaultSortBy = opts.defaultSortBy ?? 'createdAt';
    const defaultSortDir = opts.defaultSortDir ?? 'desc';
    const pageSize = opts.pageSize ?? 20;
    const initialFilters = { ...(opts.initialFilters ?? {}) };

    const params = signal<AdminListParams>({
      page: 1,
      pageSize,
      q: '',
      sortBy: defaultSortBy,
      sortDir: defaultSortDir,
      filters: initialFilters,
    });
    const data = signal<AdminPage<T>>(
      emptyAdminPage<T>({ sortBy: defaultSortBy, sortDir: defaultSortDir, pageSize }),
    );
    const loading = signal(false);
    const error = signal('');
    const searchInput = signal('');
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let seq = 0;

    const reload = async () => {
      const s = ++seq;
      loading.set(true);
      error.set('');
      try {
        const qs = buildListQuery(params());
        const raw = await this.api.request<unknown>(`${opts.path}?${qs}`);
        if (s !== seq) return;
        data.set(
          normalizeAdminPage<T>(raw, {
            sortBy: params().sortBy,
            sortDir: params().sortDir,
            pageSize: params().pageSize,
          }),
        );
      } catch (e: unknown) {
        if (s !== seq) return;
        error.set(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (s === seq) loading.set(false);
      }
    };

    return {
      params,
      data,
      loading,
      error,
      searchInput,
      reload,
      setPage(page: number) {
        params.update((p) => ({ ...p, page: Math.max(1, page) }));
        void reload();
      },
      setPageSize(size: number) {
        params.update((p) => ({ ...p, pageSize: size, page: 1 }));
        void reload();
      },
      setFilter(key: string, value: string) {
        params.update((p) => ({
          ...p,
          page: 1,
          filters: { ...p.filters, [key]: value },
        }));
        void reload();
      },
      setFilters(next: Record<string, string>) {
        params.update((p) => ({ ...p, page: 1, filters: { ...next } }));
        void reload();
      },
      toggleSort(col: string) {
        params.update((p) => {
          if (p.sortBy === col) {
            return { ...p, sortDir: p.sortDir === 'asc' ? 'desc' : 'asc', page: 1 };
          }
          return { ...p, sortBy: col, sortDir: 'asc', page: 1 };
        });
        void reload();
      },
      onSearchChange(value: string) {
        searchInput.set(value);
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          params.update((p) => {
            if (p.q === value) return p;
            return { ...p, q: value, page: 1 };
          });
          void reload();
        }, 350);
      },
    };
  }
}
