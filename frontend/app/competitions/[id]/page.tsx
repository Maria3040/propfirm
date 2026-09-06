'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  findCompetition,
  formatCountdown,
  formatShortDate,
} from '@/lib/competitions-data';

export default function CompetitionDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const c = findCompetition(id);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  return (
    <div className="comp-page">
      <div className="comp-heading">
        <Link href="/competitions" className="rw-back">
          ← Competitions
        </Link>
        <h1>{c.title}</h1>
      </div>

      <div className="rw-card" style={{ padding: '1.5rem', maxWidth: '40rem' }}>
        <p className="meta" style={{ marginTop: 0 }}>
          {c.kind} · {c.host} · {c.platform}
        </p>
        <p>
          Status:{' '}
          <strong>{c.status === 'ongoing' ? 'Ongoing' : c.status === 'ended' ? 'Ended' : 'Upcoming'}</strong>
        </p>
        <p>
          Starts <strong>{formatShortDate(c.startsAt)}</strong> · Ends{' '}
          <strong>{formatShortDate(c.endsAt)}</strong>
        </p>
        <p>
          Ending in:{' '}
          <strong>{c.status === 'ended' ? '00:00:00' : formatCountdown(c.endsAt, now)}</strong>
        </p>
        <p>
          Entry: <strong>{c.entry}</strong> · Participants:{' '}
          <strong>{c.participants.toLocaleString()}</strong>
        </p>
        <div
          className="prose-comp"
          style={{ marginTop: '1rem' }}
          dangerouslySetInnerHTML={{ __html: c.prizeHtml }}
        />
        <p className="meta">Demo competition — join flow is not wired yet.</p>
      </div>
    </div>
  );
}
