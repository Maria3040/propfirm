'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getSession } from '@/lib/api';
import AccountDetailPanel from '@/components/accounts/AccountDetailPanel';
import {
  accountNo,
  ChallengeRow,
  isArchived,
  money,
  phaseLabel,
  sizeLabel,
  statusClass,
  typeLabel,
} from '@/lib/accounts-format';

type Wallet = { traderId: string; availableBalance: number };

const TYPE_OPTS = [
  { value: 'all', label: 'All Types' },
  { value: '1step', label: '1 Step' },
  { value: '2step', label: '2 Step' },
  { value: 'zero', label: 'Zero' },
  { value: 'competition', label: 'Competition' },
];

const STATE_OPTS = [
  { value: 'all', label: 'All States' },
  { value: 'Active', label: 'Active' },
  { value: 'Funded', label: 'Funded' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Closed', label: 'Closed' },
];

const PHASE_OPTS = [
  { value: 'all', label: 'All Phases' },
  { value: '1', label: 'Phase 1' },
  { value: '2', label: 'Phase 2' },
  { value: 'funded', label: 'Funded' },
];

function matchesType(sku: string, filter: string) {
  if (filter === 'all') return true;
  const s = sku.toLowerCase();
  if (filter === '1step') return s.includes('1step') || s.includes('1_step') || s.includes('one');
  if (filter === '2step') return s.includes('2step') || s.includes('2_step') || s.includes('two');
  if (filter === 'zero') return s.includes('zero');
  if (filter === 'competition') return s.includes('compet');
  return true;
}

function AccountMenu({
  id,
  archived,
  onArchived,
}: {
  id: string;
  archived: boolean;
  onArchived: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function archive(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (archived || busy) return;
    if (!confirm('Archive this account?')) return;
    setBusy(true);
    try {
      await api(`/api/challenges/${id}/archive`, { method: 'POST', body: '{}' });
      setOpen(false);
      onArchived();
    } catch (err: any) {
      alert(err.message || 'Archive failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acc-menu" onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        className="acc-menu-btn"
        aria-label="Account actions"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋮
      </button>
      {open ? (
        <>
          <button type="button" className="acc-menu-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="acc-menu-pop" role="menu">
            {!archived ? (
              <button type="button" role="menuitem" disabled={busy} onClick={archive}>
                Archive
              </button>
            ) : (
              <span className="acc-menu-muted">Already archived</span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AccountsWorkspace({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [err, setErr] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [stateF, setStateF] = useState('all');
  const [phaseF, setPhaseF] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [compact, setCompact] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState('Trader');
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    setErr('');
    Promise.all([
      api<ChallengeRow[]>('/api/challenges').catch(() => [] as ChallengeRow[]),
      api<Wallet>('/api/payouts/wallet').catch(() => null),
      api<{ displayName?: string; email?: string }>('/api/users/me').catch(() => null),
    ])
      .then(([ch, w, me]) => {
        setRows(ch);
        setWallet(w);
        const session = getSession();
        const display = me?.displayName || session?.displayName || '';
        const email = me?.email || session?.email || '';
        if (display) setName(display.split(' ')[0] || 'Trader');
        else if (email) setName(email.split('@')[0] || 'Trader');
      })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(selectedId ? `/accounts/${selectedId}` : '/accounts')}`);
      return;
    }
    setReady(true);
    load();
  }, [load, router, selectedId]);

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      const archived = isArchived(c.status);
      if (!showArchived && archived) return false;
      if (!matchesType(c.sku, typeF)) return false;
      if (stateF !== 'all' && c.status !== stateF) return false;
      if (phaseF === 'funded') {
        if (!(c.status === 'Funded' || c.currentPhase > c.phases)) return false;
      } else if (phaseF !== 'all' && String(c.currentPhase) !== phaseF) {
        return false;
      }
      return true;
    });
  }, [rows, showArchived, typeF, stateF, phaseF]);

  const rewardCount = rows.filter((r) => r.status === 'Funded').length;
  const totalRewards = wallet?.availableBalance ?? 0;

  if (!ready) {
    return <p className="meta">Redirecting to login…</p>;
  }

  return (
    <div className={`acc-desk${selectedId ? ' has-selection' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className={`acc-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="acc-sidebar-inner">
          <div className="acc-list-pad">
            <section className="acc-header">
              <div className="acc-header-glow" aria-hidden="true" />
              <div className="acc-header-top">
                <h1>Hey, {name}</h1>
                <p>Your PropFirm account overview</p>
              </div>
              <div className="acc-metrics">
                <div>
                  <div className="acc-metric-label">Trader Rank</div>
                  <div className="acc-tier">Bronze Tier</div>
                </div>
                <div>
                  <div className="acc-metric-label">Reward Count</div>
                  <div className="acc-metric-value">{rewardCount}</div>
                </div>
                <div>
                  <div className="acc-metric-label">Total Rewards</div>
                  <div className="acc-metric-value">
                    ${totalRewards.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="acc-list-body">
            <div className="acc-buy-wrap">
              <Link href="/" className="acc-buy">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12Z" />
                </svg>
                <span>BUY CHALLENGE</span>
              </Link>
            </div>

            <div className="acc-filters">
              <label className="acc-select">
                <span className="sr-only">All Types</span>
                <select value={typeF} onChange={(e) => setTypeF(e.target.value)}>
                  {TYPE_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="acc-select">
                <span className="sr-only">All States</span>
                <select value={stateF} onChange={(e) => setStateF(e.target.value)}>
                  {STATE_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="acc-select">
                <span className="sr-only">All Phases</span>
                <select value={phaseF} onChange={(e) => setPhaseF(e.target.value)}>
                  {PHASE_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="acc-toolbar">
              <div />
              <div className="acc-toggles">
                <button
                  type="button"
                  className={`acc-toggle${showArchived ? ' on' : ''}`}
                  aria-pressed={showArchived}
                  aria-label="Show Archived"
                  title="Show Archived"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                    <path d="M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88Z" />
                  </svg>
                  <span className={`acc-dot${showArchived ? ' on' : ''}`} />
                </button>
                <button
                  type="button"
                  className={`acc-toggle${compact ? ' on' : ''}`}
                  aria-pressed={compact}
                  aria-label="Compact View"
                  title="Compact View"
                  onClick={() => setCompact((v) => !v)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                    <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
                  </svg>
                  <span className={`acc-dot${compact ? ' on' : ''}`} />
                </button>
              </div>
            </div>

            {err ? <p className="err acc-list-err">{err}</p> : null}

            <div className="acc-scroll">
              {filtered.length === 0 ? (
                <div className="acc-empty">
                  <p>No accounts match these filters.</p>
                  <span>Buy a challenge to get started.</span>
                  <Link href="/" className="acc-buy sm">
                    BUY CHALLENGE
                  </Link>
                </div>
              ) : (
                filtered.map((c) => {
                  const selected = selectedId === c.id;
                  const archived = isArchived(c.status);
                  const type = typeLabel(c.sku);
                  const phase = phaseLabel(c);
                  const pnl = c.pnl ?? 0;
                  const pct = c.profitPct ?? 0;
                  return (
                    <Link
                      key={c.id}
                      href={`/accounts/${c.id}`}
                      className={`acc-card${selected ? ' is-active' : ''}${compact ? ' is-compact' : ''}`}
                    >
                      {selected ? <span className="acc-active-bar" aria-hidden="true" /> : null}
                      <div className="acc-card-top">
                        <div className="acc-card-id">
                          <svg
                            className="acc-phase-icon"
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            fill="currentColor"
                            viewBox="0 0 256 256"
                            aria-hidden="true"
                          >
                            <path d="M192,32H64A32,32,0,0,0,32,64V192a32,32,0,0,0,32,32H192a32,32,0,0,0,32-32V64A32,32,0,0,0,192,32Zm16,160a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64A16,16,0,0,1,64,48H192a16,16,0,0,1,16,16ZM104,92A12,12,0,1,1,92,80,12,12,0,0,1,104,92Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,92Zm-72,72a12,12,0,1,1-12-12A12,12,0,0,1,104,164Zm36-36a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm36,36a12,12,0,1,1-12-12A12,12,0,0,1,176,164Z" />
                          </svg>
                          <div>
                            <div className="acc-card-title">#{accountNo(c)}</div>
                            <div className="acc-card-sub">
                              <span>{sizeLabel(c.accountSize)}</span>
                              <span aria-hidden="true">•</span>
                              <span>{type}</span>
                              <span aria-hidden="true">•</span>
                              <span>{phase}</span>
                            </div>
                          </div>
                        </div>
                        <div className="acc-card-right">
                          <span className={statusClass(c.status)}>{c.status}</span>
                          <AccountMenu id={c.id} archived={archived} onArchived={load} />
                        </div>
                      </div>
                      {!compact ? (
                        <div className="acc-card-grid">
                          <div>
                            <div className="acc-metric-label">Balance</div>
                            <div className="acc-metric-value">
                              ${(c.equity ?? c.accountSize).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div className="acc-metric-label">Account Type</div>
                            <div className="acc-metric-value">{type}</div>
                          </div>
                          <div>
                            <div className="acc-metric-label">P&amp;L</div>
                            <div className={`acc-metric-value${pnl >= 0 ? ' up' : ' down'}`}>{money(pnl)}</div>
                          </div>
                          <div>
                            <div className="acc-metric-label">Profit %</div>
                            <div className={`acc-metric-value${pct >= 0 ? ' up' : ' down'}`}>
                              {pct >= 0 ? '+' : ''}
                              {pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="acc-collapse-btn"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div className="acc-main">
        {selectedId ? (
          <AccountDetailPanel challengeId={selectedId} onArchived={load} />
        ) : (
          <div className="acc-detail-empty acc-detail-placeholder">
            <h2>Select an account</h2>
            <p className="meta">Choose an account from the list to view analytics, objectives, and credentials.</p>
          </div>
        )}
      </div>
    </div>
  );
}
