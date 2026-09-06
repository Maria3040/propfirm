'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAdminList } from '@/hooks/useAdminList';
import { AdminPager, AdminTableToolbar, SortTh } from '@/components/admin/AdminTableToolbar';

type Tab = 'overview' | 'payouts' | 'traders' | 'challenges' | 'catalog' | 'audit' | 'mail';

type Overview = {
  traders: number;
  challengesActive: number;
  challengesFunded: number;
  challengesFailed: number;
  payoutsPending: number;
  payoutsNeedsVpsInvoice?: number;
  ordersPaid: number;
  productsActive: number;
  generatedAt?: string;
};

const TABS: Tab[] = ['overview', 'payouts', 'traders', 'challenges', 'catalog', 'audit', 'mail'];

function isTab(v: string | null): v is Tab {
  return !!v && (TABS as string[]).includes(v);
}

function canDecidePayout(status: string) {
  return status === 'Pending' || status === 'NeedsVpsInvoice';
}

function AdminPageInner() {
  const { ready, isAdmin } = useRequireAdmin();
  const router = useRouter();
  const search = useSearchParams();
  const tabFromUrl = search.get('tab');
  const statusFromUrl = search.get('status') || '';
  const [tab, setTab] = useState<Tab>(isTab(tabFromUrl) ? tabFromUrl : 'overview');
  const [err, setErr] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [commentFor, setCommentFor] = useState<{ id: string; email: string | null } | null>(null);
  const [commentSubject, setCommentSubject] = useState('Regarding your payout request');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentFlash, setCommentFlash] = useState('');

  const traders = useAdminList<any>({
    path: '/api/admin/traders',
    enabled: isAdmin && tab === 'traders',
  });
  const challenges = useAdminList<any>({
    path: '/api/admin/challenges',
    enabled: isAdmin && tab === 'challenges',
    initialFilters: { status: isTab(tabFromUrl) && tabFromUrl === 'challenges' ? statusFromUrl : '' },
  });
  const payouts = useAdminList<any>({
    path: '/api/admin/payouts',
    enabled: isAdmin && tab === 'payouts',
    initialFilters: { status: isTab(tabFromUrl) && tabFromUrl === 'payouts' ? statusFromUrl : '' },
  });
  const products = useAdminList<any>({
    path: '/api/admin/catalog/products',
    enabled: isAdmin && tab === 'catalog',
    defaultSortBy: 'accountSize',
    defaultSortDir: 'asc',
  });
  const audit = useAdminList<any>({
    path: '/api/admin/audit',
    enabled: isAdmin && tab === 'audit',
    defaultSortBy: 'occurredAt',
  });
  const mail = useAdminList<any>({
    path: '/api/admin/notifications',
    enabled: isAdmin && tab === 'mail',
  });

  useEffect(() => {
    if (isTab(tabFromUrl)) setTab(tabFromUrl);
    else if (!tabFromUrl) setTab('overview');
  }, [tabFromUrl]);

  function replaceAdminUrl(next: Tab, extra?: Record<string, string>) {
    const sp = new URLSearchParams();
    if (next !== 'overview') sp.set('tab', next);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v) sp.set(k, v);
      }
    }
    const qs = sp.toString();
    router.replace(qs ? `/admin?${qs}` : '/admin');
  }

  function goTab(next: Tab, extra?: Record<string, string>) {
    setTab(next);
    setErr('');
    if (next === 'payouts') {
      payouts.setFilters({ status: extra?.status || '' });
    }
    if (next === 'challenges') {
      challenges.setFilters({ status: extra?.status || '' });
    }
    replaceAdminUrl(next, extra);
  }

  function onPayoutStatusFilter(value: string) {
    payouts.setFilter('status', value);
    replaceAdminUrl('payouts', value ? { status: value } : undefined);
  }

  function onChallengeStatusFilter(value: string) {
    challenges.setFilter('status', value);
    replaceAdminUrl('challenges', value ? { status: value } : undefined);
  }

  const loadOverview = useCallback(async () => {
    if (!isAdmin) return;
    setErr('');
    try {
      setOverview(await api<Overview>('/api/admin/overview'));
    } catch (e: any) {
      setErr(e.message || 'Failed to load overview');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'overview') void loadOverview();
  }, [tab, loadOverview]);

  async function refreshActive() {
    if (tab === 'overview') await loadOverview();
    else if (tab === 'traders') await traders.reload();
    else if (tab === 'challenges') await challenges.reload();
    else if (tab === 'payouts') await payouts.reload();
    else if (tab === 'catalog') await products.reload();
    else if (tab === 'audit') await audit.reload();
    else if (tab === 'mail') await mail.reload();
  }

  async function decidePayout(id: string, approve: boolean) {
    setBusy(true);
    setErr('');
    try {
      await api(`/api/admin/payouts/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' });
      await payouts.reload();
      await loadOverview();
    } catch (e: any) {
      setErr(e.message || 'payout decision failed');
    } finally {
      setBusy(false);
    }
  }

  async function requestVpsInvoice(id: string) {
    setBusy(true);
    setErr('');
    try {
      await api(`/api/admin/payouts/${id}/request-vps-invoice`, { method: 'POST' });
      await payouts.reload();
    } catch (e: any) {
      setErr(e.message || 'VPS invoice request failed');
    } finally {
      setBusy(false);
    }
  }

  async function markVpsReceived(id: string) {
    setBusy(true);
    setErr('');
    try {
      await api(`/api/admin/payouts/${id}/vps-invoice-received`, { method: 'POST' });
      await payouts.reload();
    } catch (e: any) {
      setErr(e.message || 'mark invoice received failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    if (!commentFor) return;
    if (!commentMessage.trim()) {
      setErr('Message is required');
      return;
    }
    setBusy(true);
    setCommentFlash('');
    setErr('');
    try {
      const res = await api<{ ok: boolean; toEmail?: string }>(`/api/admin/payouts/${commentFor.id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          subject: commentSubject.trim() || 'Regarding your payout request',
          message: commentMessage.trim(),
        }),
      });
      setCommentFlash(`Email queued to ${res.toEmail || commentFor.email || 'trader'}`);
      setCommentFor(null);
      setCommentMessage('');
      if (tab === 'mail') await mail.reload();
    } catch (e: any) {
      setErr(
        e.message === 'Not Found'
          ? 'Comment API not found — restart the Python API on :6080, then try again.'
          : e.message || 'comment email failed',
      );
    } finally {
      setBusy(false);
    }
  }

  async function closeChallenge(id: string) {
    if (!window.confirm('Force-close this challenge and lock the trading account?')) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/api/admin/challenges/${id}/close`, { method: 'POST' });
      await challenges.reload();
    } catch (e: any) {
      setErr(e.message || 'close failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleProduct(id: string, isActive: boolean) {
    setBusy(true);
    setErr('');
    try {
      await api(`/api/admin/catalog/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await products.reload();
    } catch (e: any) {
      setErr(e.message || 'catalog update failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !isAdmin) {
    return (
      <div className="admin-panel">
        <h1>Admin</h1>
        <p className="meta">Checking admin session…</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'payouts', label: 'Payouts' },
    { id: 'traders', label: 'Traders' },
    { id: 'challenges', label: 'Challenges' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'audit', label: 'Audit' },
    { id: 'mail', label: 'Mail' },
  ];

  const pendingHint = overview?.payoutsPending ?? 0;

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <h1>Admin panel</h1>
          <p className="lead">
            Manage traders, challenges, catalog, payouts, and audit. Lists load from the server with
            search, filters, sort, and pagination.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => void refreshActive()} disabled={busy}>
          Refresh
        </button>
      </header>

      {err && <p className="err">{err}</p>}
      {commentFlash && <p className="meta">{commentFlash}</p>}

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => goTab(t.id)}
          >
            {t.label}
            {t.id === 'payouts' && pendingHint ? ` (${pendingHint})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <section className="admin-cards" aria-label="Overview">
          {(
            [
              ['Traders', overview.traders, () => goTab('traders')],
              ['Active challenges', overview.challengesActive, () => goTab('challenges', { status: 'Active' })],
              ['Funded', overview.challengesFunded, () => goTab('challenges', { status: 'Funded' })],
              ['Failed', overview.challengesFailed, () => goTab('challenges', { status: 'Failed' })],
              ['Pending payouts', overview.payoutsPending, () => goTab('payouts', { status: 'Pending' })],
              [
                'Needs VPS invoice',
                overview.payoutsNeedsVpsInvoice ?? 0,
                () => goTab('payouts', { status: 'NeedsVpsInvoice' }),
              ],
              ['Paid orders', overview.ordersPaid, undefined],
              ['Active SKUs', overview.productsActive, () => goTab('catalog')],
            ] as [string, number, (() => void) | undefined][]
          ).map(([label, value, onClick]) => (
            <button
              key={label}
              type="button"
              className="admin-card"
              onClick={onClick}
              disabled={!onClick}
            >
              <span>{label}</span>
              <strong>{value}</strong>
            </button>
          ))}
          {overview.generatedAt && (
            <p className="meta" style={{ gridColumn: '1 / -1' }}>
              Aggregated on server · {new Date(overview.generatedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {tab === 'payouts' && (
        <section>
          <h2>Payout queue</h2>
          <p className="rw-form-hint">
            Filter by <strong>Pending</strong> to approve/reject. Already Approved/Rejected rows keep
            the buttons visible but disabled. Comment emails the trader.
          </p>
          <AdminTableToolbar
            search={payouts.searchInput}
            onSearchChange={payouts.onSearchChange}
            searchPlaceholder="Search email, id, address…"
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: payouts.params.filters.status || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'NeedsVpsInvoice', label: 'Needs VPS invoice' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                ],
              },
            ]}
            onFilterChange={(_k, v) => onPayoutStatusFilter(v)}
            page={payouts.data.page}
            pageSize={payouts.params.pageSize}
            total={payouts.data.total}
            totalPages={payouts.data.totalPages}
            onPageChange={payouts.setPage}
            onPageSizeChange={payouts.setPageSize}
            loading={payouts.loading}
          />
          {payouts.error && <p className="err">{payouts.error}</p>}
          <div className={`stack admin-list-body${payouts.loading ? ' is-loading' : ''}`}>
            {payouts.data.items.length === 0 && !payouts.loading && (
              <p className="meta">No payouts match.</p>
            )}
            {payouts.data.items.map((p) => {
              const actionable = canDecidePayout(p.status);
              const approveDisabled = busy || !actionable || !p.canApprove;
              const rejectDisabled = busy || !actionable;
              return (
                <div key={p.id} className="card row admin-row">
                  <div>
                    <strong>${Number(p.amount).toFixed(2)}</strong> · {p.status}
                    {p.vpsInvoiceStatus ? ` · VPS: ${p.vpsInvoiceStatus}` : ''}
                    <div className="meta">
                      {p.traderEmail || p.traderId} · {p.method} · {p.cryptoNetwork || '—'}
                    </div>
                    {p.cryptoAddress && <code className="admin-code">{p.cryptoAddress}</code>}
                    {p.ipRisk?.hasViolation ? (
                      <p className="err" style={{ marginTop: '0.5rem' }}>
                        IP violation: {p.ipRisk.summary}
                        {p.ipRisk.lastIp ? ` (IP ${p.ipRisk.lastIp})` : ''}
                      </p>
                    ) : (
                      <p className="meta" style={{ marginTop: '0.35rem' }}>
                        {p.ipRisk?.summary || 'No IP risk flags'}
                      </p>
                    )}
                    {!actionable && (
                      <p className="meta">Already decided — Approve / Reject are disabled.</p>
                    )}
                    {actionable && !p.canApprove && p.approveBlockedReason && (
                      <p className="meta">Approve blocked: {p.approveBlockedReason}</p>
                    )}
                  </div>
                  <div className="admin-actions" style={{ flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        setErr('');
                        setCommentFlash('');
                        setCommentFor({ id: p.id, email: p.traderEmail });
                        setCommentSubject(`Regarding your payout ${String(p.id).slice(0, 8)}`);
                        setCommentMessage('');
                      }}
                    >
                      Comment
                    </button>
                    {actionable && p.ipRisk?.requiresVpsInvoice && p.vpsInvoiceStatus !== 'Received' && (
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void requestVpsInvoice(p.id)}
                      >
                        Request VPS invoice
                      </button>
                    )}
                    {actionable && p.vpsInvoiceStatus === 'Requested' && (
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void markVpsReceived(p.id)}
                      >
                        Mark invoice received
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      disabled={approveDisabled}
                      title={
                        !actionable
                          ? 'Already decided'
                          : p.approveBlockedReason || 'Approve and send reward'
                      }
                      onClick={() => void decidePayout(p.id, true)}
                    >
                      Approve &amp; send
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={rejectDisabled}
                      title={!actionable ? 'Already decided' : 'Reject payout'}
                      onClick={() => void decidePayout(p.id, false)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <AdminPager
            page={payouts.data.page}
            pageSize={payouts.params.pageSize}
            total={payouts.data.total}
            totalPages={payouts.data.totalPages}
            onPageChange={payouts.setPage}
            onPageSizeChange={payouts.setPageSize}
            loading={payouts.loading}
          />
        </section>
      )}

      {tab === 'traders' && (
        <section>
          <h2>Traders</h2>
          <AdminTableToolbar
            search={traders.searchInput}
            onSearchChange={traders.onSearchChange}
            searchPlaceholder="Search email or name…"
            filters={[
              {
                key: 'role',
                label: 'Role',
                value: traders.params.filters.role || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Trader', label: 'Trader' },
                  { value: 'Admin', label: 'Admin' },
                ],
              },
            ]}
            onFilterChange={traders.setFilter}
            page={traders.data.page}
            pageSize={traders.params.pageSize}
            total={traders.data.total}
            totalPages={traders.data.totalPages}
            onPageChange={traders.setPage}
            onPageSizeChange={traders.setPageSize}
            loading={traders.loading}
          />
          {traders.error && <p className="err">{traders.error}</p>}
          <div className={traders.loading ? 'admin-list-body is-loading' : 'admin-list-body'}>
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="Email" column="email" sortBy={traders.params.sortBy} sortDir={traders.params.sortDir} onSort={traders.toggleSort} />
                  <SortTh label="Role" column="role" sortBy={traders.params.sortBy} sortDir={traders.params.sortDir} onSort={traders.toggleSort} />
                  <th>Wallet</th>
                  <th>Challenges</th>
                  <SortTh label="Created" column="createdAt" sortBy={traders.params.sortBy} sortDir={traders.params.sortDir} onSort={traders.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {traders.data.items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.displayName}
                      <div className="meta">{t.email}</div>
                    </td>
                    <td>{t.role}</td>
                    <td>${Number(t.walletBalance || 0).toFixed(2)}</td>
                    <td>{t.challengeCount}</td>
                    <td className="meta">{t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPager
            page={traders.data.page}
            pageSize={traders.params.pageSize}
            total={traders.data.total}
            totalPages={traders.data.totalPages}
            onPageChange={traders.setPage}
            onPageSizeChange={traders.setPageSize}
            loading={traders.loading}
          />
        </section>
      )}

      {tab === 'challenges' && (
        <section>
          <h2>Challenges</h2>
          <AdminTableToolbar
            search={challenges.searchInput}
            onSearchChange={challenges.onSearchChange}
            searchPlaceholder="Search SKU, email, id…"
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: challenges.params.filters.status || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Funded', label: 'Funded' },
                  { value: 'Failed', label: 'Failed' },
                  { value: 'Closed', label: 'Closed' },
                ],
              },
            ]}
            onFilterChange={(_k, v) => onChallengeStatusFilter(v)}
            page={challenges.data.page}
            pageSize={challenges.params.pageSize}
            total={challenges.data.total}
            totalPages={challenges.data.totalPages}
            onPageChange={challenges.setPage}
            onPageSizeChange={challenges.setPageSize}
            loading={challenges.loading}
          />
          {challenges.error && <p className="err">{challenges.error}</p>}
          <div className={`stack admin-list-body${challenges.loading ? ' is-loading' : ''}`}>
            {challenges.data.items.map((c) => (
              <div key={c.id} className="card row admin-row">
                <div>
                  <strong>
                    {c.sku} · {c.status}
                  </strong>
                  <div className="meta">
                    {c.traderEmail} · equity ${Number(c.equity).toFixed(2)} · phase {c.currentPhase}
                    {c.failReason ? ` · ${c.failReason}` : ''}
                  </div>
                </div>
                {c.status !== 'Closed' && c.status !== 'Failed' && (
                  <button type="button" className="btn danger" disabled={busy} onClick={() => void closeChallenge(c.id)}>
                    Force close
                  </button>
                )}
              </div>
            ))}
          </div>
          <AdminPager
            page={challenges.data.page}
            pageSize={challenges.params.pageSize}
            total={challenges.data.total}
            totalPages={challenges.data.totalPages}
            onPageChange={challenges.setPage}
            onPageSizeChange={challenges.setPageSize}
            loading={challenges.loading}
          />
        </section>
      )}

      {tab === 'catalog' && (
        <section>
          <h2>Catalog products</h2>
          <AdminTableToolbar
            search={products.searchInput}
            onSearchChange={products.onSearchChange}
            searchPlaceholder="Search SKU or name…"
            filters={[
              {
                key: 'isActive',
                label: 'Active',
                value: products.params.filters.isActive || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ],
              },
            ]}
            onFilterChange={products.setFilter}
            page={products.data.page}
            pageSize={products.params.pageSize}
            total={products.data.total}
            totalPages={products.data.totalPages}
            onPageChange={products.setPage}
            onPageSizeChange={products.setPageSize}
            loading={products.loading}
          />
          {products.error && <p className="err">{products.error}</p>}
          <div className={products.loading ? 'admin-list-body is-loading' : 'admin-list-body'}>
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="SKU" column="sku" sortBy={products.params.sortBy} sortDir={products.params.sortDir} onSort={products.toggleSort} />
                  <SortTh label="Size" column="accountSize" sortBy={products.params.sortBy} sortDir={products.params.sortDir} onSort={products.toggleSort} />
                  <SortTh label="Price" column="price" sortBy={products.params.sortBy} sortDir={products.params.sortDir} onSort={products.toggleSort} />
                  <SortTh label="Split" column="profitSplitPct" sortBy={products.params.sortBy} sortDir={products.params.sortDir} onSort={products.toggleSort} />
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {products.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>${Number(p.accountSize).toLocaleString()}</td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td>{p.profitSplitPct}%</td>
                    <td>
                      <button type="button" className="btn" disabled={busy} onClick={() => void toggleProduct(p.id, !p.isActive)}>
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPager
            page={products.data.page}
            pageSize={products.params.pageSize}
            total={products.data.total}
            totalPages={products.data.totalPages}
            onPageChange={products.setPage}
            onPageSizeChange={products.setPageSize}
            loading={products.loading}
          />
        </section>
      )}

      {tab === 'audit' && (
        <section>
          <h2>Audit timeline</h2>
          <AdminTableToolbar
            search={audit.searchInput}
            onSearchChange={audit.onSearchChange}
            searchPlaceholder="Search type, source, summary…"
            page={audit.data.page}
            pageSize={audit.params.pageSize}
            total={audit.data.total}
            totalPages={audit.data.totalPages}
            onPageChange={audit.setPage}
            onPageSizeChange={audit.setPageSize}
            loading={audit.loading}
          />
          {audit.error && <p className="err">{audit.error}</p>}
          <div className={audit.loading ? 'admin-list-body is-loading' : 'admin-list-body'}>
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="When" column="occurredAt" sortBy={audit.params.sortBy} sortDir={audit.params.sortDir} onSort={audit.toggleSort} />
                  <SortTh label="Type" column="eventType" sortBy={audit.params.sortBy} sortDir={audit.params.sortDir} onSort={audit.toggleSort} />
                  <SortTh label="Source" column="source" sortBy={audit.params.sortBy} sortDir={audit.params.sortDir} onSort={audit.toggleSort} />
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.occurredAt).toLocaleString()}</td>
                    <td>{a.eventType}</td>
                    <td>{a.source}</td>
                    <td>{a.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPager
            page={audit.data.page}
            pageSize={audit.params.pageSize}
            total={audit.data.total}
            totalPages={audit.data.totalPages}
            onPageChange={audit.setPage}
            onPageSizeChange={audit.setPageSize}
            loading={audit.loading}
          />
        </section>
      )}

      {tab === 'mail' && (
        <section>
          <h2>Notification outbox</h2>
          <AdminTableToolbar
            search={mail.searchInput}
            onSearchChange={mail.onSearchChange}
            searchPlaceholder="Search to / subject…"
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: mail.params.filters.status || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Sent', label: 'Sent' },
                  { value: 'Failed', label: 'Failed' },
                ],
              },
            ]}
            onFilterChange={mail.setFilter}
            page={mail.data.page}
            pageSize={mail.params.pageSize}
            total={mail.data.total}
            totalPages={mail.data.totalPages}
            onPageChange={mail.setPage}
            onPageSizeChange={mail.setPageSize}
            loading={mail.loading}
          />
          {mail.error && <p className="err">{mail.error}</p>}
          <div className={mail.loading ? 'admin-list-body is-loading' : 'admin-list-body'}>
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="When" column="createdAt" sortBy={mail.params.sortBy} sortDir={mail.params.sortDir} onSort={mail.toggleSort} />
                  <SortTh label="To" column="toEmail" sortBy={mail.params.sortBy} sortDir={mail.params.sortDir} onSort={mail.toggleSort} />
                  <SortTh label="Subject" column="subject" sortBy={mail.params.sortBy} sortDir={mail.params.sortDir} onSort={mail.toggleSort} />
                  <SortTh label="Status" column="status" sortBy={mail.params.sortBy} sortDir={mail.params.sortDir} onSort={mail.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {mail.data.items.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                    <td>{m.toEmail}</td>
                    <td>{m.subject}</td>
                    <td>
                      {m.status}
                      {m.deliveryDetail ? ` · ${m.deliveryDetail}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPager
            page={mail.data.page}
            pageSize={mail.params.pageSize}
            total={mail.data.total}
            totalPages={mail.data.totalPages}
            onPageChange={mail.setPage}
            onPageSizeChange={mail.setPageSize}
            loading={mail.loading}
          />
        </section>
      )}

      {commentFor && (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => !busy && setCommentFor(null)}>
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-comment-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="payout-comment-title">Email trader</h3>
            <p className="meta">To: {commentFor.email || 'unknown'}</p>
            <label className="admin-field" htmlFor="payout-comment-subject">
              Subject
              <input
                id="payout-comment-subject"
                value={commentSubject}
                onChange={(e) => setCommentSubject(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="admin-field" htmlFor="payout-comment-message">
              Message
              <textarea
                id="payout-comment-message"
                value={commentMessage}
                onChange={(e) => setCommentMessage(e.target.value)}
                rows={6}
                maxLength={4000}
                placeholder="Write your message to the trader…"
              />
            </label>
            <div className="admin-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setCommentFor(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !commentMessage.trim()}
                onClick={() => void sendComment()}
              >
                {busy ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-panel">
          <h1>Admin</h1>
          <p className="meta">Loading…</p>
        </div>
      }
    >
      <AdminPageInner />
    </Suspense>
  );
}
