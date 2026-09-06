'use client';

import { useEffect, useState } from 'react';
import { api, getSession } from '@/lib/api';

export default function AdminPage() {
  const [audit, setAudit] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [err, setErr] = useState('');

  function reload() {
    api<any[]>('/api/admin/audit?limit=30')
      .then(setAudit)
      .catch((e) => setErr(String(e.message || e)));
    api<any[]>('/api/payouts')
      .then(setPayouts)
      .catch(() => undefined);
  }

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'Admin') {
      setErr('Login as admin@propfirm.local / Admin1!');
      return;
    }
    reload();
  }, []);

  async function decide(id: string, approve: boolean) {
    await api(`/api/admin/payouts/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' });
    reload();
  }

  return (
    <>
      <h1>Admin</h1>
      <p className="lead">Audit hub + payout decisions</p>
      {err && <p className="err">{err}</p>}

      <h2>Pending / recent payouts</h2>
      <div className="stack">
        {payouts.map((p) => (
          <div key={p.id} className="card row">
            <span>
              ${p.amount} · {p.status} · {p.traderId.slice(0, 8)}…
            </span>
            {p.status === 'Pending' && (
              <>
                <button className="btn" onClick={() => decide(p.id, true)}>
                  Approve
                </button>
                <button className="btn danger" onClick={() => decide(p.id, false)}>
                  Reject
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: '2rem' }}>Audit timeline</h2>
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {audit.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.occurredAt).toLocaleString()}</td>
              <td>{a.eventType}</td>
              <td>{a.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
