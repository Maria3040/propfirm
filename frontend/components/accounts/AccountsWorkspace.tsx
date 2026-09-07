'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { api, getSession } from '@/lib/api';
import AccountDetailPanel from '@/components/accounts/AccountDetailPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useRequireAuth } from '@/hooks/useRequireAuth';
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
  { value: 'live', label: 'Active, Funded & Passed' },
  { value: 'all', label: 'All States' },
  { value: 'Active', label: 'Active' },
  { value: 'Funded', label: 'Funded' },
  { value: 'Passed', label: 'Passed' },
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
  login,
  archived,
  onArchived,
}: {
  id: string;
  login?: string;
  archived: boolean;
  onArchived: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuErr, setMenuErr] = useState('');

  function askArchive(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (archived || busy) return;
    setMenuErr('');
    setConfirmOpen(true);
    setOpen(false);
  }

  async function doArchive() {
    setBusy(true);
    setMenuErr('');
    try {
      await api(`/api/challenges/${id}/archive`, { method: 'POST', body: '{}' });
      setConfirmOpen(false);
      onArchived();
    } catch (ex: any) {
      setMenuErr(ex.message || 'Archive failed');
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
              <button type="button" role="menuitem" disabled={busy} onClick={askArchive}>
                Archive
              </button>
            ) : (
              <span className="acc-menu-muted">Already archived</span>
            )}
          </div>
        </>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Archive this account?"
        description={`#${login || id.slice(0, 9)} will be closed. We’ll email you a link to undo.`}
        confirmLabel="Archive"
        danger
        busy={busy}
        onCancel={() => !busy && setConfirmOpen(false)}
        onConfirm={() => void doArchive()}
      />
      {menuErr ? <p className="err acc-menu-err">{menuErr}</p> : null}
    </div>
  );
}

function EmptyDetailPanel({ noAccounts }: { noAccounts: boolean }) {
  return (
    <div className="acc-select-empty">
      <div className="acc-select-empty-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256">
          <path d="M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z" />
        </svg>
      </div>
      <h3>Select an Account to View Details</h3>
      <p>Choose a trading account from the list to see its detailed information and performance metrics.</p>
      <div className="acc-select-empty-cta">
        <p>
          {noAccounts ? (
            <>
              Don&apos;t have an account yet?
              <br />
              Trade up to $400,000 in simulated capital.
            </>
          ) : (
            <>
              Need another account?
              <br />
              Trade up to $400,000 in simulated capital.
            </>
          )}
        </p>
        <Link href="/new-challenge" className="acc-buy-challenge-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
            <path d="M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z" />
          </svg>
          Buy Challenge
        </Link>
      </div>
    </div>
  );
}

export default function AccountsWorkspace({ selectedId }: { selectedId?: string }) {
  const { ready: authReady, authenticated } = useRequireAuth(
    selectedId ? `/accounts/${selectedId}` : '/accounts',
  );
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [err, setErr] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [stateF, setStateF] = useState('live');
  const [phaseF, setPhaseF] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [compact, setCompact] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState('Trader');

  const load = useCallback(() => {
    setErr('');
    Promise.all([
      api<ChallengeRow[]>('/api/challenges').catch(() => [] as ChallengeRow[]),
      api<Wallet>('/api/payouts/wallet').catch(() => null),
      api<{ displayName?: string; email?: string }>('/api/users/me').catch(() => null),
    ])
      .then(([ch, w, me]) => {
        setRows(Array.isArray(ch) ? ch : []);
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
    if (!authenticated) return;
    load();
  }, [authenticated, load]);

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      const archived = isArchived(c);
      if (!matchesType(c.sku, typeF)) return false;
      if (showArchived) return archived;
      if (archived) return false;
      if (stateF === 'live') {
        if (!(c.status === 'Active' || c.status === 'Funded' || c.status === 'Passed')) return false;
      } else if (stateF !== 'all' && c.status !== stateF) {
        return false;
      }
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
  const noAccounts = rows.filter((r) => !isArchived(r)).length === 0;

  if (!authReady || !authenticated) {
    return <p className="meta">Checking session…</p>;
  }

  return (
    <div className={`acc-desk${selectedId ? ' has-selection' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className={`acc-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="acc-sidebar-inner">
          <div className="acc-list-pad">
            <div className="acc-list-inset">
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
          </div>

          <div className="acc-list-body">
            <div className="acc-buy-wrap">
              <Link href="/new-challenge" className="acc-buy">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z" />
                </svg>
                <span>Buy Challenge</span>
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
                <span className="sr-only">States</span>
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
                  <p>{noAccounts ? 'No accounts yet.' : 'No accounts match these filters.'}</p>
                  <span>Buy a challenge or join a competition to get started.</span>
                </div>
              ) : (
                filtered.map((c) => {
                  const selected = selectedId === c.id;
                  const archived = isArchived(c);
                  const type = typeLabel(c.sku);
                  const phase = phaseLabel(c);
                  const pnl = c.pnl ?? (c.equity ?? c.accountSize) - c.accountSize;
                  const pct =
                    c.profitPct ??
                    (c.accountSize ? (((c.equity ?? c.accountSize) - c.accountSize) / c.accountSize) * 100 : 0);
                  const title =
                    c.kind === 'competition' && c.competitionTitle
                      ? c.competitionTitle
                      : `#${accountNo(c)}`;
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
                            <div className="acc-card-title">{title}</div>
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
                          {c.kind !== 'competition' ? (
                            <AccountMenu id={c.id} login={accountNo(c)} archived={archived} onArchived={load} />
                          ) : null}
                        </div>
                      </div>
                      {!compact ? (
                        <div className="acc-card-grid">
                          <div>
                            <div className="acc-metric-label">Balance</div>
                            <div className="acc-metric-value">
                              {`$${(c.equity ?? c.accountSize).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </div>
                          </div>
                          <div>
                            <div className="acc-metric-label">Account Type</div>
                            <div className="acc-metric-value">{type}</div>
                          </div>
                          <div>
                            <div className="acc-metric-label">P&amp;L</div>
                            <div className={`acc-metric-value${pnl >= 0 ? ' up' : ' down'}`}>
                              {money(pnl)}
                            </div>
                          </div>
                          <div>
                            <div className="acc-metric-label">Profit %</div>
                            <div className={`acc-metric-value${pct >= 0 ? ' up' : ' down'}`}>
                              {`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
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
          <EmptyDetailPanel noAccounts={noAccounts} />
        )}
      </div>
    </div>
  );
}
