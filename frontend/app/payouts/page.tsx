'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAdminList } from '@/hooks/useAdminList';
import { AdminPager, AdminTableToolbar } from '@/components/admin/AdminTableToolbar';

type Wallet = { availableBalance: number };
type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  decidedAt?: string | null;
  method?: string;
  rewardType?: string;
  challengeId?: string | null;
};

function AwardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M216,96A88,88,0,1,0,72,163.83V240a8,8,0,0,0,11.58,7.16L128,225l44.43,22.21A8.07,8.07,0,0,0,176,248a8,8,0,0,0,8-8V163.83A87.85,87.85,0,0,0,216,96ZM56,96a72,72,0,1,1,72,72A72.08,72.08,0,0,1,56,96ZM168,227.06l-36.43-18.21a8,8,0,0,0-7.16,0L88,227.06V174.37a87.89,87.89,0,0,0,80,0ZM128,152A56,56,0,1,0,72,96,56.06,56.06,0,0,0,128,152Zm0-96A40,40,0,1,1,88,96,40,40,0,0,1,128,56Z" />
    </svg>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function methodLabel(method?: string) {
  const m = (method || '').toLowerCase();
  if (m === 'crypto') return 'Crypto';
  if (m === 'bank') return 'Bank transfer';
  if (m === 'rise') return 'Rise';
  return method || '—';
}

function statusLabel(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'Pending';
  if (s === 'approved' || s === 'paid') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  return status || '—';
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

export default function PayoutsPage() {
  const router = useRouter();
  const { ready, authenticated } = useRequireAuth('/payouts');
  const [wallet, setWallet] = useState<Wallet>({ availableBalance: 0 });
  const [err, setErr] = useState('');
  const list = useAdminList<PayoutRow>({
    path: '/api/payouts',
    enabled: authenticated,
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    pageSize: 10,
  });

  useEffect(() => {
    if (!authenticated) return;
    api<Wallet>('/api/payouts/wallet')
      .then(setWallet)
      .catch((e) => {
        const msg = String(e.message || e);
        if (/unauthorized/i.test(msg)) {
          router.replace(`/login?next=${encodeURIComponent('/payouts')}`);
          return;
        }
        setErr(msg);
      });
  }, [authenticated, router]);

  if (!ready || !authenticated) {
    return (
      <div className="rw-page">
        <div className="rw-heading">
          <h1>Rewards</h1>
        </div>
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  const empty = (
    <div className="rw-empty">
      <p className="rw-empty-title">No reward history yet</p>
      <p className="rw-empty-sub">Completed and pending reward requests will appear here.</p>
    </div>
  );

  return (
    <div className="rw-page">
      <div className="rw-heading">
        <h1>Rewards</h1>
        <p className="rw-balance meta">
          Available balance: <strong>${Number(wallet.availableBalance || 0).toFixed(2)}</strong>
        </p>
      </div>

      {(err || list.error) && <p className="err">{err || list.error}</p>}

      <div className="rw-top-grid">
        <div className="rw-card rw-cert">
          <AwardIcon />
          <h3>No Certificate Available</h3>
          <p>You&apos;ll earn your reward certificate once you start receiving rewards.</p>
          <p className="rw-muted">Keep trading to unlock your achievements!</p>
        </div>

        <div className="rw-card rw-request">
          <div>
            <h3>Ready to request your reward?</h3>
            <p>
              Please click on the request button then proceed to fill out the required information,
              our team will reach out to you for further advancements.
            </p>
          </div>
          <Link href="/payouts/request" className="rw-btn">
            Request Reward
          </Link>
        </div>
      </div>

      <section className="rw-history">
        <AdminTableToolbar
          search={list.searchInput}
          onSearchChange={list.onSearchChange}
          searchPlaceholder="Search payout id, method, challenge…"
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: list.params.filters.status || '',
              options: [
                { value: '', label: 'All' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Approved', label: 'Approved' },
                { value: 'Rejected', label: 'Rejected' },
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

        <div className="rw-card hist-table-card">
          <div className="rw-table-head">
            <p className="rw-section-label">Payout history</p>
          </div>
          <div className="hist-table-scroll">
            <table className="rw-table">
              <thead>
                <tr>
                  <SortTh label="Reference" col="createdAt" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                  <th>Reward Type</th>
                  <th>Requested On</th>
                  <SortTh label="Method" col="method" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                  <SortTh label="Status" col="status" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                  <SortTh label="Amount" col="amount" sortBy={list.params.sortBy} sortDir={list.params.sortDir} onSort={list.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {list.data.total === 0 ? (
                  <tr>
                    <td colSpan={6}>{empty}</td>
                  </tr>
                ) : (
                  list.data.items.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id.slice(0, 8)}…</td>
                      <td>{r.rewardType || 'Profit share'}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>{methodLabel(r.method)}</td>
                      <td>
                        <span className={`rw-status rw-status-${(r.status || '').toLowerCase()}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td>${Number(r.amount).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
      </section>
    </div>
  );
}
