'use client';

type FilterOption = { value: string; label: string };

type PagerProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
};

export function AdminPager({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  loading,
}: PagerProps) {
  return (
    <div className="admin-pager">
      <button type="button" className="btn" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      <span className="meta">
        Page {page} of {Math.max(1, totalPages)} · {total} total
        {loading ? ' · Updating…' : ''}
      </span>
      <button
        type="button"
        className="btn"
        disabled={page >= totalPages || loading || total === 0}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
      <label className="admin-filter admin-filter-inline">
        <span>Rows</span>
        <select
          value={pageSize}
          disabled={loading}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: { key: string; label: string; value: string; options: FilterOption[] }[];
  onFilterChange?: (key: string, value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
  /** When true, only render search/filters (pager rendered separately). */
  filtersOnly?: boolean;
};

export function AdminTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  onFilterChange,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  loading,
  filtersOnly,
}: Props) {
  return (
    <div className={`admin-toolbar${loading ? ' is-loading' : ''}`}>
      <div className="admin-toolbar-row">
        <label className="admin-search">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        {filters.map((f) => (
          <label key={f.key} className="admin-filter">
            <span>{f.label}</span>
            <select
              value={f.value}
              onChange={(e) => onFilterChange?.(f.key, e.target.value)}
            >
              {f.options.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {!filtersOnly && (
        <AdminPager
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          loading={loading}
        />
      )}
    </div>
  );
}

export function SortTh({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: string;
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <th>
      <button type="button" className={`admin-sort${active ? ' on' : ''}`} onClick={() => onSort(column)}>
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}
