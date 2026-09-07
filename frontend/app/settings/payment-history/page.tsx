'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAdminList } from '@/hooks/useAdminList';
import { AdminPager, AdminTableToolbar } from '@/components/admin/AdminTableToolbar';

type PaymentRow = {
  id: string;
  sku: string;
  price: number;
  status: string;
  paymentIntentId?: string | null;
  createdAt: string;
  paidAt?: string | null;
  accountSize?: number;
  platform?: string;
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function SortTh({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  col: string;
  sortBy: string;
  sortDir: string;
  onSort: (col: string) => void;
}) {
  const active = sortBy === col;
  return (
    <th>
      <button type="button" className="hist-sort" onClick={() => onSort(col)}>
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

export default function PaymentHistoryPage() {
  const { ready, authenticated } = useRequireAuth('/settings/payment-history');
  const list = useAdminList<PaymentRow>({
    path: '/api/payments/history',
    enabled: authenticated,
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    pageSize: 10,
  });

  if (!ready || !authenticated) {
    return (
      <div className="settings-page">
        <h1 className="settings-page-title">Payment History</h1>
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Payment History</h1>
      <p className="meta">Orders from challenge purchases (EF write path · Dapper read model).</p>

      <AdminTableToolbar
        search={list.searchInput}
        onSearchChange={list.onSearchChange}
        searchPlaceholder="Search SKU, order id, payment intent…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: list.params.filters.status || '',
            options: [
              { value: '', label: 'All' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Paid', label: 'Paid' },
            ],
          },
        ]}
        onFilterChange={list.setFilter}
        page={list.data.page}
        pageSize={list.data.pageSize}
        total={list.data.total}
        totalPages={list.data.totalPages}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        loading={list.loading}
        filtersOnly
      />

      {list.error ? <p className="err">{list.error}</p> : null}

      {list.data.total === 0 && !list.loading ? (
        <div className="sph-empty">
          <h3>No payment history</h3>
          <p>Purchase your first challenge to get started</p>
          <Link href="/" className="sph-cta">
            <span>Buy Challenge</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="rw-card rw-table-wrap hist-table-wrap hist-table-card">
            <div className="hist-table-scroll">
              <table className="rw-table">
                <thead>
                  <tr>
                    <SortTh label="Order" col="createdAt" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                    <SortTh label="SKU" col="sku" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                    <SortTh label="Amount" col="price" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                    <SortTh label="Status" col="status" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                    <th>Platform</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.id.slice(0, 8)}…</code>
                        <div className="meta">{formatDate(r.createdAt)}</div>
                      </td>
                      <td>{r.sku}</td>
                      <td>${Number(r.price).toFixed(2)}</td>
                      <td>{r.status}</td>
                      <td>{r.platform || '—'}</td>
                      <td>{formatDate(r.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <AdminPager
            page={list.data.page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            totalPages={list.data.totalPages}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            loading={list.loading}
          />
        </>
      )}
    </div>
  );
}
