'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSession } from '@/lib/api';
import {
  findCompetition,
  formatCountdown,
  formatShortDate,
  type Competition,
  type CompetitionStatus,
} from '@/lib/competitions-data';
import {
  COMPETITION_RULES,
  formatStandingMoney,
  getCompetitionStandings,
  type CompetitionStanding,
} from '@/lib/competition-standings';
import { useFilteredPagination } from '@/lib/list-utils';
import { PageNumberPager } from '@/components/PageNumberPager';
import { GoldMedal, RankMedal, SilverMedal } from '@/components/competition/Medals';

type ModalKind = 'prize' | 'about' | null;
type SortKey = 'rankAsc' | 'profitDesc' | 'profitAsc' | 'tradesDesc' | 'winRatioDesc' | 'nameAsc' | 'joinedAsc';

type RegisteredParticipant = {
  rank: number;
  traderId: string;
  name: string;
  email?: string | null;
  login?: string | null;
  platform?: string | null;
  accountSize?: number;
  joinedAt: string;
};

type BoardRow = CompetitionStanding & {
  joinedAt?: string;
  login?: string | null;
  accountSize?: number;
  isRegisteredOnly?: boolean;
};

function FlagBadge({ code }: { code: string }) {
  return (
    <span className="cd-flag" title={code} aria-label={`${code} flag`}>
      {code}
    </span>
  );
}

function StatusDot({ status }: { status: CompetitionStatus }) {
  const label = status === 'ongoing' ? 'Ongoing' : status === 'ended' ? 'Ended' : 'Upcoming';
  return (
    <div className="cd-status">
      <span className={`cd-status-dot ${status}`} />
      <p>{label}</p>
    </div>
  );
}

function statusMessage(c: Competition) {
  if (c.status === 'ended') return 'This competition has ended';
  if (c.status === 'upcoming') return 'Registration is open — join before it starts';
  return 'Competition is live';
}

function CompModal({
  open,
  title,
  html,
  onClose,
}: {
  open: boolean;
  title: string;
  html: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="comp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-modal-title"
        className="comp-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="comp-modal-header">
          <h2 id="cd-modal-title">{title}</h2>
        </header>
        <div className="comp-modal-body prose-comp" dangerouslySetInnerHTML={{ __html: html }} />
        <button type="button" className="comp-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}

function Podium({ rows }: { rows: CompetitionStanding[] }) {
  const first = rows[0];
  const second = rows[1];
  const third = rows[2];
  if (!first) return null;

  return (
    <div className="cd-podium" aria-label="Top three">
      {second && (
        <div className="cd-podium-slot side">
          <SilverMedal size={120} className="cd-medal" />
          <span className="cd-podium-name">{second.name}</span>
          <span className="cd-podium-place">2</span>
          <FlagBadge code={second.country} />
        </div>
      )}
      <div className="cd-podium-slot center">
        <GoldMedal size={180} className="cd-medal" />
        <span className="cd-podium-name">{first.name}</span>
        <span className="cd-podium-place">1</span>
        <FlagBadge code={first.country} />
      </div>
      {third && (
        <div className="cd-podium-slot side">
          <SilverMedal size={120} className="cd-medal" />
          <span className="cd-podium-name">{third.name}</span>
          <span className="cd-podium-place">3</span>
          <FlagBadge code={third.country} />
        </div>
      )}
    </div>
  );
}

function RegistrationHero({ count }: { count: number }) {
  return (
    <div className="cd-reg-hero" aria-label="Registration open">
      <p className="cd-reg-kicker">Pre-start roster</p>
      <strong>{count.toLocaleString()}</strong>
      <span>traders joined</span>
      <p className="cd-reg-note">Leaderboard metrics unlock when the competition starts.</p>
    </div>
  );
}

export default function CompetitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');
  const c = findCompetition(id);
  const [now, setNow] = useState(() => Date.now());
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [modal, setModal] = useState<ModalKind>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rankAsc');
  const [registered, setRegistered] = useState<RegisteredParticipant[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);

  const isUpcoming = c?.status === 'upcoming';
  const standings = useMemo(() => (c && !isUpcoming ? getCompetitionStandings(c.id) : []), [c, isUpcoming]);

  const boardRows: BoardRow[] = useMemo(() => {
    if (isUpcoming) {
      return registered.map((p) => ({
        rank: p.rank,
        name: p.name,
        country: '—',
        trades: 0,
        winRatio: 0,
        profit: 0,
        gainPct: 0,
        joinedAt: p.joinedAt,
        login: p.login,
        accountSize: p.accountSize || 100_000,
        isRegisteredOnly: true,
      }));
    }
    return standings;
  }, [isUpcoming, registered, standings]);

  const matchStanding = useCallback((row: BoardRow, q: string) => {
    return (
      row.name.toLowerCase().includes(q) ||
      row.country.toLowerCase().includes(q) ||
      String(row.rank).includes(q) ||
      (row.login || '').toLowerCase().includes(q)
    );
  }, []);

  const compare = useMemo(() => {
    switch (sortKey) {
      case 'profitDesc':
        return (a: BoardRow, b: BoardRow) => b.profit - a.profit;
      case 'profitAsc':
        return (a: BoardRow, b: BoardRow) => a.profit - b.profit;
      case 'tradesDesc':
        return (a: BoardRow, b: BoardRow) => b.trades - a.trades;
      case 'winRatioDesc':
        return (a: BoardRow, b: BoardRow) => b.winRatio - a.winRatio;
      case 'nameAsc':
        return (a: BoardRow, b: BoardRow) => a.name.localeCompare(b.name);
      case 'joinedAsc':
        return (a: BoardRow, b: BoardRow) =>
          String(a.joinedAt || '').localeCompare(String(b.joinedAt || ''));
      case 'rankAsc':
      default:
        return (a: BoardRow, b: BoardRow) => a.rank - b.rank;
    }
  }, [sortKey]);

  const listState = useFilteredPagination(boardRows, matchStanding, {
    initialPageSize: 10,
    compare,
  });

  const loadParticipants = useCallback(() => {
    if (!id) return;
    api<{ count: number; participants: RegisteredParticipant[] }>(
      `/api/competitions/${encodeURIComponent(id)}/participants`,
    )
      .then((res) => {
        setRegistered(Array.isArray(res.participants) ? res.participants : []);
        setRegisteredCount(Number(res.count || res.participants?.length || 0));
      })
      .catch(() => {
        setRegistered([]);
        setRegisteredCount(0);
      });
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    api<{ competitionIds: string[] }>('/api/competitions/joined')
      .then((res) => setJoined((res.competitionIds || []).includes(id)))
      .catch(() => undefined);
    loadParticipants();
  }, [id, loadParticipants]);

  if (!c) {
    return (
      <div className="comp-page">
        <p className="err">Competition not found.</p>
        <Link href="/competitions" className="rw-btn">
          Back to Competitions
        </Link>
      </div>
    );
  }

  async function onJoin() {
    setErr('');
    setMsg('');
    if (!getSession()) {
      router.push(`/login?next=${encodeURIComponent(`/competitions/${id}`)}`);
      return;
    }
    if (c!.status === 'ended') return;
    setBusy(true);
    try {
      const res = await api<{ alreadyJoined: boolean; emailSent: boolean }>(
        `/api/competitions/${c!.id}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ title: c!.title }),
        },
      );
      setJoined(true);
      loadParticipants();
      if (res.alreadyJoined) setMsg('You already joined this competition.');
      else if (res.emailSent) setMsg('Joined — confirmation email sent (check Mailpit :8026).');
      else setMsg('Joined, but email delivery failed. Is Mailpit SMTP on :2525?');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  }

  const canJoin = c.status !== 'ended';
  const joinDisabled = !canJoin || joined || busy;
  const timerIso = c.status === 'upcoming' ? c.startsAt : c.endsAt;
  const participantLabel = isUpcoming
    ? Math.max(c.participants, registeredCount)
    : c.participants;

  return (
    <div className="cd-page">
      <p className="cd-back">
        <Link href="/competitions">← Competitions</Link>
      </p>

      <div className="cd-hero card-surface">
        <div className="cd-hero-main">
          <h1>{c.title}</h1>
          <div className="cd-hero-meta">
            <div className="cd-meta-item">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden className="cd-meta-icon">
                <path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z" />
              </svg>
              {c.platform}
            </div>
            <StatusDot status={c.status} />
          </div>
          <p className="cd-status-msg">{statusMessage(c)}</p>
          {c.status !== 'ended' && (
            <p className="cd-countdown meta">
              {c.status === 'upcoming' ? 'Starts in' : 'Ending in'}{' '}
              <strong>{formatCountdown(timerIso, now)}</strong>
            </p>
          )}
          <div className="cd-hero-actions">
            <button
              type="button"
              className="comp-btn-primary"
              disabled={joinDisabled}
              onClick={onJoin}
            >
              {c.status === 'ended' ? 'Join' : joined ? 'Joined' : busy ? 'Joining…' : 'Join'}
            </button>
            <button type="button" className="comp-btn-ghost" onClick={() => setModal('prize')}>
              Show Prizepool
            </button>
            <button type="button" className="comp-btn-ghost" onClick={() => setModal('about')}>
              More Info
            </button>
          </div>
          {(msg || err) && (
            <p className={err ? 'err' : 'comp-join-toast'} role="status">
              {err || msg}
            </p>
          )}
        </div>
        <div className="cd-hero-podium">
          {isUpcoming ? <RegistrationHero count={registeredCount} /> : <Podium rows={standings} />}
        </div>
      </div>

      <div className="cd-grid">
        <div className="cd-board card-surface">
          <div className="cd-toolbar">
            <label className="cd-search">
              <span className="sr-only">{isUpcoming ? 'Filter registered traders' : 'Filter rankings'}</span>
              <input
                type="search"
                placeholder={
                  isUpcoming
                    ? 'Filter by name or login…'
                    : 'Filter by name, country, rank…'
                }
                value={listState.query}
                onChange={(e) => listState.setQuery(e.target.value)}
              />
            </label>
            <label className="cd-filter">
              Sort
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  listState.setPage(1);
                }}
              >
                {isUpcoming ? (
                  <>
                    <option value="rankAsc">Join order</option>
                    <option value="joinedAsc">Joined earliest</option>
                    <option value="nameAsc">Name A–Z</option>
                  </>
                ) : (
                  <>
                    <option value="rankAsc">Rank</option>
                    <option value="profitDesc">Profit high → low</option>
                    <option value="profitAsc">Profit low → high</option>
                    <option value="tradesDesc">Most trades</option>
                    <option value="winRatioDesc">Win ratio</option>
                    <option value="nameAsc">Name A–Z</option>
                  </>
                )}
              </select>
            </label>
            <label className="cd-filter">
              Page size
              <select
                value={listState.pageSize}
                onChange={(e) => listState.setPageSize(Number(e.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
              </select>
            </label>
            <p className="cd-toolbar-meta">
              {listState.filteredTotal} traders · page {listState.page}/{listState.pageCount}
              {isUpcoming ? ' · registered' : ''}
            </p>
          </div>

          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>{isUpcoming ? '#' : 'Rank'}</th>
                  <th>Name</th>
                  {isUpcoming ? (
                    <>
                      <th>Login</th>
                      <th>Platform</th>
                      <th>Account</th>
                      <th>Joined</th>
                    </>
                  ) : (
                    <>
                      <th>Country</th>
                      <th>Trades</th>
                      <th>Win Ratio</th>
                      <th>Profit</th>
                      <th>Gain</th>
                      <th aria-label="Chart" />
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {listState.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={isUpcoming ? 6 : 8} className="cd-empty">
                      {isUpcoming
                        ? 'No traders have joined yet. Be the first.'
                        : 'No traders match this filter.'}
                    </td>
                  </tr>
                ) : (
                  listState.pageItems.map((row) => (
                    <tr
                      key={`${row.rank}-${row.name}-${row.login || ''}`}
                      className={!isUpcoming && row.rank > 3 ? 'muted-row' : ''}
                    >
                      <td>{row.rank}</td>
                      <td>
                        <span className="cd-name-cell">
                          {!isUpcoming && row.rank <= 3 ? (
                            <RankMedal rank={row.rank} size={40} />
                          ) : null}
                          {row.name}
                        </span>
                      </td>
                      {isUpcoming ? (
                        <>
                          <td className="tabular">{row.login || '—'}</td>
                          <td>matchtrader</td>
                          <td className="tabular">
                            {`$${((row.accountSize || 100000) / 1000).toFixed(0)}k`}
                          </td>
                          <td>{row.joinedAt ? formatShortDate(row.joinedAt) : '—'}</td>
                        </>
                      ) : (
                        <>
                          <td>
                            <FlagBadge code={row.country} />
                          </td>
                          <td>{row.trades}</td>
                          <td>{row.winRatio}%</td>
                          <td className="pos">{formatStandingMoney(row.profit)}</td>
                          <td className="pos">{row.gainPct.toFixed(2)}%</td>
                          <td>
                            <button
                              type="button"
                              className="cd-chart-btn"
                              aria-label={`Stats for ${row.name}`}
                              title="View stats"
                            >
                              <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                                <path d="M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z" />
                              </svg>
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PageNumberPager
            page={listState.page}
            pageCount={listState.pageCount}
            pageNumbers={listState.pageNumbers}
            onPageChange={listState.setPage}
          />
        </div>

        <aside className="cd-sidebar">
          <div className="cd-rank-card">
            <div className="cd-rank-card-title">
              {isUpcoming ? (joined ? 'You’re registered' : '? Registration') : '? Current Rank'}
            </div>
            <p className="cd-rank-card-sub">
              {isUpcoming
                ? joined
                  ? 'You’re on the joined-traders list. Rankings start when the competition goes live.'
                  : 'Join to appear on the registered traders table before start.'
                : 'Your current rank in the competition.'}
            </p>
            <button type="button" className="cd-stats-btn" disabled={!joined || isUpcoming}>
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm71.87,53.27L136,114.14V40.37A88,88,0,0,1,199.87,77.27ZM120,40.37v83l-71.89,41.5A88,88,0,0,1,120,40.37ZM128,216a88,88,0,0,1-71.87-37.27L207.89,91.12A88,88,0,0,1,128,216Z" />
              </svg>
              My Stats
            </button>
          </div>

          <div className="cd-side-panel card-surface">
            <div className="cd-side-facts">
              <div className="cd-fact">
                <div className="cd-fact-icon">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z" />
                  </svg>
                </div>
                <div>
                  <p>Starts</p>
                  <strong>{formatShortDate(c.startsAt)}</strong>
                </div>
              </div>
              <div className="cd-fact">
                <div className="cd-fact-icon">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z" />
                  </svg>
                </div>
                <div>
                  <p>Ends</p>
                  <strong>{formatShortDate(c.endsAt)}</strong>
                </div>
              </div>
              <div className="cd-fact">
                <div className="cd-fact-icon">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z" />
                  </svg>
                </div>
                <div>
                  <p>Entry</p>
                  <strong>{c.entry}</strong>
                </div>
              </div>
              <div className="cd-fact">
                <div className="cd-fact-icon">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z" />
                  </svg>
                </div>
                <div>
                  <p>Participants</p>
                  <strong>
                    {isUpcoming
                      ? `${registeredCount.toLocaleString()} joined`
                      : participantLabel.toLocaleString()}
                  </strong>
                </div>
              </div>
              <div className="cd-fact">
                <div className="cd-fact-icon">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z" />
                  </svg>
                </div>
                <div>
                  <p>Organizer</p>
                  <strong>{c.host}</strong>
                </div>
              </div>
            </div>

            <h3 className="cd-rules-title">Trading Rules</h3>
            <ul className="cd-rules">
              {COMPETITION_RULES.map((rule) => (
                <li key={rule}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
                  </svg>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <CompModal
        open={modal === 'prize'}
        title="Prize pool for this competition"
        html={c.prizeHtml}
        onClose={() => setModal(null)}
      />
      <CompModal
        open={modal === 'about'}
        title="About this Competition"
        html={c.aboutHtml}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
