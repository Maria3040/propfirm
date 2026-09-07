'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAdminList } from '@/hooks/useAdminList';
import { AdminPager, AdminTableToolbar } from '@/components/admin/AdminTableToolbar';

type NotificationRow = {
  id: string;
  toEmail?: string;
  toemail?: string;
  subject: string;
  body: string;
  status: string;
  deliveryDetail?: string | null;
  createdAt?: string;
  createdat?: string;
};

function pickDate(n: NotificationRow) {
  return n.createdAt ?? n.createdat ?? null;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

export default function NotificationsPage() {
  const { ready, authenticated } = useRequireAuth('/notifications');
  const list = useAdminList<NotificationRow>({
    path: '/api/notifications',
    enabled: authenticated,
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    pageSize: 10,
  });

  if (!ready || !authenticated) {
    return (
      <div className="rw-page">
        <div className="rw-heading">
          <h1>Notifications</h1>
        </div>
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="rw-page notif-page">
      <div className="rw-heading">
        <h1>Notifications</h1>
        <p className="meta">Emails and system messages for your account (search is debounced).</p>
      </div>

      <AdminTableToolbar
        search={list.searchInput}
        onSearchChange={list.onSearchChange}
        searchPlaceholder="Search subject, body, delivery…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: list.params.filters.status || '',
            options: [
              { value: '', label: 'All' },
              { value: 'Queued', label: 'Queued' },
              { value: 'Sent', label: 'Sent' },
              { value: 'Failed', label: 'Failed' },
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

      <div className="notif-table-card">
        {list.data.total === 0 && !list.loading ? (
          <div className="rw-empty">
            <p className="rw-empty-title">No notifications yet</p>
            <p className="rw-empty-sub">Purchase, phase pass, competition join, and payout emails will show here.</p>
          </div>
        ) : (
          <div className="notif-table-scroll">
            <table className="rw-table notif-table">
              <thead>
                <tr>
                  <SortTh
                    label="When"
                    col="createdAt"
                    sortBy={list.params.sortBy}
                    sortDir={list.params.sortDir}
                    onSort={list.toggleSort}
                  />
                  <SortTh
                    label="Subject"
                    col="subject"
                    sortBy={list.params.sortBy}
                    sortDir={list.params.sortDir}
                    onSort={list.toggleSort}
                  />
                  <SortTh
                    label="Status"
                    col="status"
                    sortBy={list.params.sortBy}
                    sortDir={list.params.sortDir}
                    onSort={list.toggleSort}
                  />
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((n) => (
                  <tr key={n.id}>
                    <td className="notif-when">{formatDate(pickDate(n))}</td>
                    <td>
                      <strong>{n.subject}</strong>
                    </td>
                    <td>
                      <span className={`rw-status rw-status-${(n.status || '').toLowerCase()}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="notif-preview">
                      {(n.body || '').slice(0, 120)}
                      {(n.body || '').length > 120 ? '…' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {list.data.total > 0 ? (
        <div className="notif-pager">
          <AdminPager
            page={list.data.page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            totalPages={list.data.totalPages}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            loading={list.loading}
          />
        </div>
      ) : null}
    </div>
  );
}
