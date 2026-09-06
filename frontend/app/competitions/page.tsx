'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, getSession } from '@/lib/api';
import {
  COMPETITIONS,
  formatCountdown,
  formatShortDate,
  type Competition,
  type CompetitionStatus,
} from '@/lib/competitions-data';

type Tab = 'joined' | 'propfirm' | 'championships' | 'hosted';
type ModalKind = 'prize' | 'about' | null;

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
  onShowPrizes,
  onMoreInfo,
}: {
  c: Competition;
  countdown: string;
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
            <p>Ending in</p>
            <strong>{c.status === 'ended' ? '00:00:00' : countdown}</strong>
          </div>
        </div>
        <div className="comp-featured-actions">
          <Link href={`/competitions/${c.id}`} className="comp-btn-primary">
            View
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

function CompetitionCard({ c, countdown }: { c: Competition; countdown: string }) {
  return (
    <article className="comp-card">
      <div className="comp-card-timer">
        <time dateTime={c.endsAt}>{c.status === 'ended' ? '00:00:00' : countdown}</time>
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
        <Link href={`/competitions/${c.id}`} className="comp-btn-primary compact">
          View
        </Link>
      </footer>
    </article>
  );
}

export default function CompetitionsPage() {
  const [tab, setTab] = useState<Tab>('propfirm');
  const [name, setName] = useState('Trader');
  const [now, setNow] = useState(() => Date.now());
  const [modal, setModal] = useState<ModalKind>(null);

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
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const featured = useMemo(() => COMPETITIONS.find((c) => c.featured) || COMPETITIONS[0], []);
  const list = useMemo(() => {
    if (tab === 'joined' || tab === 'hosted' || tab === 'championships') return [] as Competition[];
    return COMPETITIONS;
  }, [tab]);

  const initial = (name || 'T').charAt(0).toUpperCase();

  return (
    <div className="comp-page">
      <div className="comp-heading">
        <div className="comp-avatar">{initial}</div>
        <h1>Hey, {name}</h1>
      </div>

      <div className="comp-body">
        <div className="comp-featured-wrap">
          <FeaturedCard
            c={featured}
            countdown={formatCountdown(featured.endsAt, now)}
            onShowPrizes={() => setModal('prize')}
            onMoreInfo={() => setModal('about')}
          />
        </div>

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
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <section className="comp-list">
          {list.length === 0 ? (
            <div className="comp-list-empty">
              <p>No competitions in this tab yet.</p>
            </div>
          ) : (
            <div className="comp-grid">
              {list.map((c) => (
                <CompetitionCard key={c.id} c={c} countdown={formatCountdown(c.endsAt, now)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <CompModal
        open={modal === 'prize'}
        title="Prize pool for this competition"
        html={featured.prizeHtml}
        onClose={() => setModal(null)}
      />
      <CompModal
        open={modal === 'about'}
        title="About this Competition"
        html={featured.aboutHtml}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
