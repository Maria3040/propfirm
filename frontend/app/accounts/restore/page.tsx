'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Suspense } from 'react';

function RestoreInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [msg, setMsg] = useState('Restoring account…');
  const [err, setErr] = useState('');
  const [id, setId] = useState('');

  useEffect(() => {
    if (!token) {
      setErr('Missing restore token.');
      setMsg('');
      return;
    }
    api<{ ok?: boolean; id?: string; status?: string }>(`/api/challenges/restore?token=${encodeURIComponent(token)}`)
      .then((r) => {
        setId(r.id || '');
        setMsg(`Account restored (${r.status || 'ok'}).`);
        if (r.id) {
          window.setTimeout(() => router.replace(`/accounts/${r.id}`), 1200);
        }
      })
      .catch((e) => {
        setErr(e.message || 'Restore failed');
        setMsg('');
      });
  }, [token, router]);

  return (
    <div className="rw-page">
      <div className="rw-heading">
        <h1>Restore archived account</h1>
      </div>
      {msg ? <p className="meta">{msg}</p> : null}
      {err ? <p className="err">{err}</p> : null}
      {id ? (
        <p>
          <Link href={`/accounts/${id}`}>Open account</Link>
        </p>
      ) : (
        <p>
          <Link href="/accounts">Back to accounts</Link>
        </p>
      )}
    </div>
  );
}

export default function RestorePage() {
  return (
    <Suspense fallback={<p className="meta">Loading…</p>}>
      <RestoreInner />
    </Suspense>
  );
}
