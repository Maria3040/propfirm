'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSession } from '@/lib/api';
import {
  CHAMPIONSHIPS,
  COMPETITIONS,
  formatCountdown,
  formatShortDate,
  type Competition,
  type CompetitionStatus,
} from '@/lib/competitions-data';
import { useFilteredPagination } from '@/lib/list-utils';
import { VirtualizedList } from '@/components/VirtualizedList';
import { PageNumberPager } from '@/components/PageNumberPager';

type Tab = 'joined' | 'propfirm' | 'championships' | 'hosted';
type ModalKind = 'prize' | 'about' | null;
type StatusFilter = 'all' | CompetitionStatus;
type SortKey = 'startsDesc' | 'startsAsc' | 'titleAsc' | 'participantsDesc' | 'status';

const STATUS_RANK: Record<CompetitionStatus, number> = {
  upcoming: 0,
  ongoing: 1,
  ended: 2,
};

function StatusDot({ status }: { status: CompetitionStatus }) {
  return (
    <div className="comp-status">
      <span className={`comp-status-dot ${status}`} />
      <p>{status === 'ongoing' ? 'Ongoing' : status === 'ended' ? 'Ended' : 'Upcoming'}</p>
    </div>
  );
}

function MetaIcon({ kind }: { kind: 'tag' | 'users' }) {
  if (kind === 'tag') {
    return (
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
        <path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z" />
    </svg>
  );
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
        aria-labelledby="comp-modal-title"
        className="comp-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="comp-modal-header">
          <h2 id="comp-modal-title">{title}</h2>
        </header>
        <div className="comp-modal-body prose-comp" dangerouslySetInnerHTML={{ __html: html }} />
        <button type="button" className="comp-modal-close" onClick={onClose} aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FeaturedCard({
  c,
  countdown,
  joined,
  joining,
  onJoin,
  onShowPrizes,
  onMoreInfo,
}: {
  c: Competition;
  countdown: string;
  joined: boolean;
  joining: boolean;
  onJoin: () => void;
  onShowPrizes: () => void;
  onMoreInfo: () => void;
}) {
  return (
    <section className="comp-featured">
      <div className="comp-featured-overlay" />
      <div className="comp-featured-body">
        <header>
          <h4>{c.kind}</h4>
        </header>
        <div className="comp-featured-main">
          <h2>{c.title}</h2>
          <div className="comp-featured-meta">
            <StatusDot status={c.status} />
            <div className="comp-meta-item">
              <MetaIcon kind="tag" />
              {c.platform}
            </div>
            <div className="comp-meta-item">
              <MetaIcon kind="users" />
              {c.participants.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="comp-featured-dates">
          <div>
            <p>Starts</p>
            <strong>{formatShortDate(c.startsAt)}</strong>
          </div>
          <div>
            <p>Ends</p>
            <strong>{formatShortDate(c.endsAt)}</strong>
          </div>
          <div>
            <p>{c.status === 'upcoming' ? 'Starts in' : 'Ending in'}</p>
            <strong>
              {c.status === 'ended'
                ? '00:00:00'
                : countdown}
            </strong>
          </div>
        </div>
        <div className="comp-featured-actions">
          {c.status === 'upcoming' ? (
            <button
              type="button"
              className="comp-btn-primary"
              disabled={joined || joining}
              onClick={onJoin}
            >
              {joined ? 'Joined' : joining ? 'Joining…' : 'Join'}
            </button>
          ) : (
            <Link href={`/competitions/${c.id}`} className="comp-btn-primary">
              View
            </Link>
          )}
          <Link href={`/competitions/${c.id}`} className="comp-btn-ghost">
            Details
          </Link>
          <button type="button" className="comp-btn-ghost" onClick={onShowPrizes}>
            Show Prizepool
          </button>
          <button type="button" className="comp-btn-ghost" onClick={onMoreInfo}>
            More Info
          </button>
        </div>
      </div>
      <div className="comp-featured-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trophy-pink.webp" alt="" className="comp-trophy" width={256} height={256} />
      </div>
    </section>
  );
}

function CompetitionCard({
  c,
  countdown,
  joined,
  joining,
  onJoin,
}: {
  c: Competition;
  countdown: string;
  joined: boolean;
  joining: boolean;
  onJoin: () => void;
}) {
  return (
    <article className="comp-card">
      <div className="comp-card-timer">
        <time dateTime={c.status === 'upcoming' ? c.startsAt : c.endsAt}>
          {c.status === 'ended' ? '00:00:00' : countdown}
        </time>
      </div>
      <h2>{c.title}</h2>
      <div className="comp-card-meta">
        <StatusDot status={c.status} />
        <div className="comp-meta-item">
          <MetaIcon kind="tag" />
          <span>{c.entry}</span>
        </div>
        <div className="comp-meta-item muted">
          <MetaIcon kind="users" />
          <span>{c.participants.toLocaleString()}</span>
        </div>
      </div>
      <footer>
        <div className="comp-chips">
          <span>{c.host}</span>
          <span>{c.platform}</span>
        </div>
        <div className="comp-card-actions">
          {c.status === 'upcoming' && (
            <button
              type="button"
              className="comp-btn-primary compact"
              disabled={joined || joining}
              onClick={onJoin}
            >
              {joined ? 'Joined' : joining ? '…' : 'Join'}
            </button>
          )}
          <Link href={`/competitions/${c.id}`} className="comp-btn-primary compact">
            View
          </Link>
        </div>
      </footer>
    </article>
  );
}

export default function CompetitionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('propfirm');
  const [name, setName] = useState('Trader');
  const [now, setNow] = useState(() => Date.now());
  const [modal, setModal] = useState<ModalKind>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('startsDesc');
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinMsg, setJoinMsg] = useState('');
  const [joinErr, setJoinErr] = useState('');

  const matchCompetition = useCallback((c: Competition, q: string) => {
    return (
      c.title.toLowerCase().includes(q) ||
      c.platform.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.status.includes(q)
    );
  }, []);

  const compare = useMemo(() => {
    switch (sortKey) {
      case 'startsAsc':
        return (a: Competition, b: Competition) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      case 'titleAsc':
        return (a: Competition, b: Competition) => a.title.localeCompare(b.title);
      case 'participantsDesc':
        return (a: Competition, b: Competition) => b.participants - a.participants;
      case 'status':
        return (a: Competition, b: Competition) =>
          STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
      case 'startsDesc':
      default:
        return (a: Competition, b: Competition) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    }
  }, [sortKey]);

  useEffect(() => {
    const session = getSession();
    api<{ displayName?: string }>('/api/users/me')
      .then((me) => {
        const n = me?.displayName || session?.displayName || 'Trader';
        setName(n.split(/\s+/)[0] || n);
      })
      .catch(() => {
        const n = session?.displayName || 'Trader';
        setName(n.split(/\s+/)[0] || n);
      });
    api<{ competitionIds: string[] }>('/api/competitions/joined')
      .then((res) => setJoinedIds(new Set(res.competitionIds || [])))
      .catch(() => setJoinedIds(new Set()));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const featured = useMemo(
    () => COMPETITIONS.find((c) => c.featured) || COMPETITIONS.find((c) => c.status === 'upcoming') || COMPETITIONS[0],
    [],
  );

  const tabList = useMemo(() => {
    if (tab === 'hosted') return [] as Competition[];
    if (tab === 'championships') return CHAMPIONSHIPS;
    if (tab === 'joined') {
      return [...COMPETITIONS, ...CHAMPIONSHIPS].filter((c) => joinedIds.has(c.id));
    }
    return COMPETITIONS;
  }, [tab, joinedIds]);

  const showFeatured = tab === 'propfirm';

  const statusScoped = useMemo(() => {
    if (statusFilter === 'all') return tabList;
    return tabList.filter((c) => c.status === statusFilter);
  }, [tabList, statusFilter]);

  const listState = useFilteredPagination(statusScoped, matchCompetition, {
    initialPageSize: 12,
    compare,
  });

  async function joinCompetition(c: Competition) {
    setJoinErr('');
    setJoinMsg('');
    if (!getSession()) {
      router.push(`/login?next=${encodeURIComponent('/competitions')}`);
      return;
    }
    setJoiningId(c.id);
    try {
      const res = await api<{ joined: boolean; alreadyJoined: boolean; emailSent: boolean }>(
        `/api/competitions/${c.id}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ title: c.title }),
        },
      );
      setJoinedIds((prev) => new Set(prev).add(c.id));
      if (res.alreadyJoined) {
        setJoinMsg(`Already joined “${c.title}”.`);
      } else if (res.emailSent) {
        setJoinMsg(`Joined “${c.title}”. Confirmation email sent — check Mailpit.`);
      } else {
        setJoinMsg(`Joined “${c.title}”. Email could not be delivered (is Mailpit on :2525?).`);
      }
    } catch (ex: unknown) {
      setJoinErr(ex instanceof Error ? ex.message : 'Join failed');
    } finally {
      setJoiningId(null);
    }
  }

  const initial = (name || 'T').charAt(0).toUpperCase();

  return (
    <div className="comp-page">
      <div className="comp-heading">
        <div className="comp-avatar">{initial}</div>
        <h1>Hey, {name}</h1>
      </div>

      <div className="comp-body">
        {showFeatured && (
          <div className="comp-featured-wrap">
            <FeaturedCard
              c={featured}
              countdown={formatCountdown(
                featured.status === 'upcoming' ? featured.startsAt : featured.endsAt,
                now,
              )}
              joined={joinedIds.has(featured.id)}
              joining={joiningId === featured.id}
              onJoin={() => joinCompetition(featured)}
              onShowPrizes={() => setModal('prize')}
              onMoreInfo={() => setModal('about')}
            />
          </div>
        )}

        {(joinMsg || joinErr) && (
          <p className={joinErr ? 'err' : 'comp-join-toast'} role="status">
            {joinErr || joinMsg}
          </p>
        )}

        <div className="comp-tabs-row">
          <div className="comp-tabs">
            {(
              [
                ['joined', 'Joined'],
                ['propfirm', 'PropFirm'],
                ['championships', 'Championships'],
                ['hosted', 'Hosted'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'on' : ''}
                onClick={() => {
                  setTab(id);
                  listState.setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="comp-toolbar">
          <label className="comp-search">
            <span className="sr-only">Search competitions</span>
            <input
              type="search"
              placeholder="Filter by title, platform…"
              value={listState.query}
              onChange={(e) => listState.setQuery(e.target.value)}
            />
          </label>
          <label className="comp-filter">
            Status
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                listState.setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="ended">Ended</option>
            </select>
          </label>
          <label className="comp-filter">
            Sort
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                listState.setPage(1);
              }}
            >
              <option value="startsDesc">Newest start</option>
              <option value="startsAsc">Oldest start</option>
              <option value="titleAsc">Title A–Z</option>
              <option value="participantsDesc">Most participants</option>
              <option value="status">Status</option>
            </select>
          </label>
          <label className="comp-filter">
            Page size
            <select
              value={listState.pageSize}
              onChange={(e) => listState.setPageSize(Number(e.target.value))}
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </label>
          <p className="comp-toolbar-meta">
            {listState.filteredTotal} matches · page {listState.page}/{listState.pageCount}
          </p>
        </div>

        <section className="comp-list">
          {listState.pageItems.length === 0 ? (
            <div className="comp-list-empty">
              <p>
                {tab === 'joined'
                  ? 'No joined competitions yet. Join an upcoming event to see it here.'
                  : tab === 'hosted'
                    ? 'You have not hosted any competitions yet.'
                    : 'No competitions match this filter.'}
              </p>
            </div>
          ) : tab === 'championships' ? (
            <div className="comp-grid">
              {listState.pageItems.map((c) => (
                <CompetitionCard
                  key={c.id}
                  c={c}
                  countdown={formatCountdown(
                    c.status === 'upcoming' ? c.startsAt : c.endsAt,
                    now,
                  )}
                  joined={joinedIds.has(c.id)}
                  joining={joiningId === c.id}
                  onJoin={() => joinCompetition(c)}
                />
              ))}
            </div>
          ) : (
            <VirtualizedList
              items={listState.pageItems}
              estimateSize={200}
              height={Math.min(640, 24 + listState.pageItems.length * 200)}
              getKey={(c) => c.id}
              renderRow={(c) => (
                <div className="comp-virt-row">
                  <CompetitionCard
                    c={c}
                    countdown={formatCountdown(
                      c.status === 'upcoming' ? c.startsAt : c.endsAt,
                      now,
                    )}
                    joined={joinedIds.has(c.id)}
                    joining={joiningId === c.id}
                    onJoin={() => joinCompetition(c)}
                  />
                </div>
              )}
            />
          )}
        </section>

        <PageNumberPager
          page={listState.page}
          pageCount={listState.pageCount}
          pageNumbers={listState.pageNumbers}
          onPageChange={listState.setPage}
        />
      </div>

      <CompModal
        open={modal === 'prize'}
        title="Prize pool for this competition"
        html={(showFeatured ? featured : listState.pageItems[0] || featured).prizeHtml}
        onClose={() => setModal(null)}
      />
      <CompModal
        open={modal === 'about'}
        title="About this Competition"
        html={(showFeatured ? featured : listState.pageItems[0] || featured).aboutHtml}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
