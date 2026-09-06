'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getSession } from '@/lib/api';
import {
  findCompetition,
  formatCountdown,
  formatShortDate,
} from '@/lib/competitions-data';

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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    api<{ competitionIds: string[] }>('/api/competitions/joined')
      .then((res) => setJoined((res.competitionIds || []).includes(id)))
      .catch(() => undefined);
  }, [id]);

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
      if (res.alreadyJoined) setMsg('You already joined this competition.');
      else if (res.emailSent) setMsg('Joined — confirmation email sent (check Mailpit :8026).');
      else setMsg('Joined, but email delivery failed. Is Mailpit SMTP on :2525?');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  }

  const timerIso = c.status === 'upcoming' ? c.startsAt : c.endsAt;

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
          {c.status === 'upcoming' ? 'Starts in' : 'Ending in'}:{' '}
          <strong>{c.status === 'ended' ? '00:00:00' : formatCountdown(timerIso, now)}</strong>
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

        {c.status === 'upcoming' && (
          <div className="comp-detail-join" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="comp-btn-primary"
              disabled={joined || busy}
              onClick={onJoin}
            >
              {joined ? 'Joined' : busy ? 'Joining…' : 'Join competition'}
            </button>
            <p className="meta">After you join we email a confirmation to your account address.</p>
          </div>
        )}

        {msg && (
          <p className="comp-join-toast" role="status">
            {msg}
          </p>
        )}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
