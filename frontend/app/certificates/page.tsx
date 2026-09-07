'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, getSession } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  certificatesFromApprovedPayouts,
  formatCertAmount,
  formatCertDate,
  type PayoutCertificate,
} from '@/lib/certificates-data';

type PayoutPage = {
  items: Array<{
    id: string;
    amount: number | string;
    status: string;
    challengeId?: string | null;
    method?: string | null;
    rewardType?: string | null;
    cryptoNetwork?: string | null;
    createdAt: string;
    decidedAt?: string | null;
  }>;
};

type ChallengeRow = { id: string; sku?: string; accountSize?: number };

function Seal() {
  return (
    <svg className="cert-seal" viewBox="0 0 96 96" aria-hidden>
      <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <circle cx="48" cy="48" r="36" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path
        fill="currentColor"
        d="M48 22l6.2 12.6 13.9 2-10 9.8 2.4 13.8L48 53.6 35.5 60.2l2.4-13.8-10-9.8 13.9-2L48 22z"
        opacity="0.85"
      />
      <text x="48" y="78" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="600">
        VERIFIED
      </text>
    </svg>
  );
}

function CertificateCard({
  cert,
  traderName,
  selected,
  onSelect,
}: {
  cert: PayoutCertificate;
  traderName: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`cert-thumb${selected ? ' on' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="cert-thumb-art" aria-hidden>
        <span className="cert-thumb-amount">{formatCertAmount(cert.amount, cert.currency)}</span>
        <span className="cert-thumb-date">{formatCertDate(cert.paidAt)}</span>
      </div>
      <div className="cert-thumb-meta">
        <strong>{traderName}</strong>
        <span>{cert.id}</span>
      </div>
    </button>
  );
}

function CertificateTemplate({ cert, traderName }: { cert: PayoutCertificate; traderName: string }) {
  return (
    <article className="cert-sheet" aria-label={`Payout certificate ${cert.id}`}>
      <div className="cert-sheet-frame">
        <header className="cert-sheet-top">
          <div className="cert-brand">
            <span className="cert-brand-mark">PF</span>
            <div>
              <p className="cert-brand-name">PropFirm</p>
              <p className="cert-brand-sub">Official Reward Certificate</p>
            </div>
          </div>
          <p className="cert-id">{cert.id}</p>
        </header>

        <div className="cert-sheet-body">
          <p className="cert-eyebrow">This certifies that</p>
          <h2 className="cert-name">{traderName}</h2>
          <p className="cert-lede">
            has successfully received a trading payout from a funded PropFirm account.
          </p>

          <div className="cert-amount-block">
            <p>Reward amount</p>
            <p className="cert-amount">{formatCertAmount(cert.amount, cert.currency)}</p>
          </div>

          <dl className="cert-grid">
            <div>
              <dt>Account size</dt>
              <dd>{cert.accountSize}</dd>
            </div>
            <div>
              <dt>Challenge</dt>
              <dd>{cert.challenge}</dd>
            </div>
            <div>
              <dt>Paid on</dt>
              <dd>{formatCertDate(cert.paidAt)}</dd>
            </div>
            <div>
              <dt>Payout method</dt>
              <dd>{cert.method}</dd>
            </div>
          </dl>
        </div>

        <footer className="cert-sheet-foot">
          <div className="cert-sign">
            <p className="cert-sign-line">Authorized signature</p>
            <p className="cert-sign-name">PropFirm Rewards Desk</p>
          </div>
          <Seal />
        </footer>
      </div>
    </article>
  );
}

export default function CertificatesPage() {
  const { ready, authenticated } = useRequireAuth('/certificates');
  const [name, setName] = useState('Trader');
  const [certs, setCerts] = useState<PayoutCertificate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const session = getSession();
        const [me, payouts, challenges] = await Promise.all([
          api<{ displayName?: string }>('/api/users/me'),
          api<PayoutPage>('/api/payouts?status=Approved&page=1&pageSize=50&sortBy=createdAt&sortDir=desc'),
          api<ChallengeRow[]>('/api/challenges').catch(() => [] as ChallengeRow[]),
        ]);
        if (cancelled) return;
        const traderName = me?.displayName || session?.displayName || 'Trader';
        setName(traderName);
        const next = certificatesFromApprovedPayouts(
          Array.isArray(payouts.items) ? payouts.items : [],
          traderName,
          Array.isArray(challenges) ? challenges : [],
        );
        setCerts(next);
        setSelectedId(next[0]?.id || '');
      } catch (ex: unknown) {
        if (!cancelled) setErr(ex instanceof Error ? ex.message : 'Failed to load certificates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const selected = useMemo(
    () => certs.find((c) => c.id === selectedId) || certs[0],
    [certs, selectedId],
  );

  if (!ready || !authenticated) {
    return (
      <div className="cert-page">
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="cert-page">
      <header className="cert-heading">
        <h1>Certificates</h1>
        <p>Official proof of trading payouts issued for your funded accounts.</p>
      </header>

      {err ? (
        <p className="err" role="alert">
          {err}
        </p>
      ) : null}
      {loading ? <p className="meta">Loading certificates…</p> : null}

      {!loading && !err && certs.length === 0 ? (
        <div className="cert-empty">
          <h2>No certificates yet</h2>
          <p>You&apos;ll earn a reward certificate once a payout is approved by admin.</p>
          <Link href="/payouts" className="cert-btn" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
            View rewards
          </Link>
        </div>
      ) : null}

      {!loading && selected ? (
        <div className="cert-layout">
          <aside className="cert-list" aria-label="Your certificates">
            {certs.map((c) => (
              <CertificateCard
                key={c.id}
                cert={c}
                traderName={name}
                selected={c.id === selected.id}
                onSelect={() => setSelectedId(c.id)}
              />
            ))}
          </aside>
          <div className="cert-preview">
            <CertificateTemplate cert={selected} traderName={name} />
            <div className="cert-actions">
              <button type="button" className="cert-btn" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
