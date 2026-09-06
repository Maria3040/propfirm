'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, getSession } from '@/lib/api';
import {
  PAYOUT_CERTIFICATES,
  formatCertAmount,
  formatCertDate,
  type PayoutCertificate,
} from '@/lib/certificates-data';

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
  const [name, setName] = useState('Alex Trader');
  const [selectedId, setSelectedId] = useState(PAYOUT_CERTIFICATES[0]?.id || '');

  useEffect(() => {
    const session = getSession();
    api<{ displayName?: string }>('/api/users/me')
      .then((me) => {
        const n = me?.displayName || session?.displayName;
        if (n) setName(n);
      })
      .catch(() => {
        if (session?.displayName) setName(session.displayName);
      });
  }, []);

  const selected = useMemo(
    () => PAYOUT_CERTIFICATES.find((c) => c.id === selectedId) || PAYOUT_CERTIFICATES[0],
    [selectedId],
  );

  return (
    <div className="cert-page">
      <header className="cert-heading">
        <h1>Certificates</h1>
        <p>Official proof of trading payouts issued for your funded accounts.</p>
      </header>

      {PAYOUT_CERTIFICATES.length === 0 || !selected ? (
        <div className="cert-empty">
          <h2>No certificates yet</h2>
          <p>You&apos;ll earn a reward certificate once a payout is approved.</p>
        </div>
      ) : (
        <div className="cert-layout">
          <aside className="cert-list" aria-label="Your certificates">
            {PAYOUT_CERTIFICATES.map((c) => (
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
              <button
                type="button"
                className="cert-btn"
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
