'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, getSession } from '@/lib/api';

type LoginHistoryRow = {
  id: string;
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isp: string | null;
  org: string | null;
  connectionKind: 'vpn' | 'vps' | 'residential' | 'local' | 'unknown' | string;
  connectionLabel: string;
  isVpn: boolean;
  isVps: boolean;
  userAgent: string | null;
  createdAt: string;
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function kindClass(kind: string) {
  switch (kind) {
    case 'vpn':
      return 'ss-kind vpn';
    case 'vps':
      return 'ss-kind vps';
    case 'residential':
      return 'ss-kind real';
    case 'local':
      return 'ss-kind local';
    default:
      return 'ss-kind unknown';
  }
}

function locationLine(row: LoginHistoryRow) {
  const parts = [row.city, row.country].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Location unknown';
}

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [twoFa, setTwoFa] = useState(false);
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyErr, setHistoryErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      setHistoryLoading(false);
      setHistoryErr('Sign in to view login history.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<LoginHistoryRow[]>('/api/users/me/login-history');
        if (!cancelled) setHistory(rows);
      } catch (ex: unknown) {
        if (!cancelled) setHistoryErr(ex instanceof Error ? ex.message : 'Failed to load history');
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onChangePassword = (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!currentPassword || !password || !confirm) {
      setErr('Please fill in all password fields.');
      return;
    }
    if (password.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('New password and confirmation do not match.');
      return;
    }
    setCurrentPassword('');
    setPassword('');
    setConfirm('');
    setMsg('Password updated (demo — not sent to the server).');
  };

  return (
    <div className="settings-page ss-page">
      <h1 className="settings-page-title ss-visually-hidden">Security</h1>

      <section className="ss-block">
        <h2 className="ss-section-title">Change Password</h2>
        <form id="change-password-form" onSubmit={onChangePassword}>
          <div className="ss-password-row">
            <div className="settings-field">
              <label htmlFor="current_password">Current Password</label>
              <input
                id="current_password"
                name="current_password"
                className="settings-input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                name="password"
                className="settings-input"
                type="password"
                autoComplete="new-password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="password_confirmation">Confirm Password</label>
              <input
                id="password_confirmation"
                name="password_confirmation"
                className="settings-input"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm New Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
          <div className="ss-password-actions">
            {err ? <p className="ss-err">{err}</p> : null}
            {msg ? <p className="ss-ok">{msg}</p> : null}
            <button type="submit" className="settings-save-btn" form="change-password-form">
              Change Password
            </button>
          </div>
        </form>
      </section>

      <section className="ss-block">
        <div className="ss-2fa-head">
          <h2 className="ss-section-title">Two-Factor Authentication</h2>
          <span className={`ss-2fa-badge${twoFa ? ' on' : ''}`}>{twoFa ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="ss-2fa-panel">
          <button
            type="button"
            className="settings-save-btn"
            onClick={() => {
              setTwoFa((v) => !v);
              setMsg(null);
              setErr(null);
            }}
          >
            {twoFa ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </div>
      </section>

      <section className="ss-block">
        <div className="ss-history-head">
          <h2 className="ss-section-title">Login History</h2>
          <p className="ss-history-desc">
            Recent sign-ins with IP, country, and whether the connection looks like a VPN, VPS/datacenter, or a
            residential (real) IP.
          </p>
        </div>

        {historyLoading ? <p className="ss-history-meta">Loading login history…</p> : null}
        {historyErr ? <p className="ss-err">{historyErr}</p> : null}

        {!historyLoading && !historyErr && history.length === 0 ? (
          <div className="ss-history-empty">
            <p>No logins recorded yet. Sign out and sign in again to capture your first session.</p>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="ss-history-table-wrap">
            <table className="ss-history-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>IP address</th>
                  <th>Location</th>
                  <th>Connection</th>
                  <th>Network</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
                    </td>
                    <td>
                      <code className="ss-history-ip">{row.ip}</code>
                    </td>
                    <td>
                      <span className="ss-history-loc">
                        {row.countryCode ? (
                          <span className="ss-history-cc" title={row.country || undefined}>
                            {row.countryCode}
                          </span>
                        ) : null}
                        {locationLine(row)}
                      </span>
                    </td>
                    <td>
                      <span className={kindClass(row.connectionKind)}>{row.connectionLabel}</span>
                    </td>
                    <td>
                      <span className="ss-history-isp" title={row.org || undefined}>
                        {row.isp || row.org || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {history.length > 0 ? (
          <ul className="ss-history-cards" aria-label="Login history">
            {history.map((row) => (
              <li key={`m-${row.id}`} className="ss-history-card">
                <div className="ss-history-card-top">
                  <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
                  <span className={kindClass(row.connectionKind)}>{row.connectionLabel}</span>
                </div>
                <code className="ss-history-ip">{row.ip}</code>
                <p>{locationLine(row)}</p>
                <p className="ss-history-isp">{row.isp || row.org || 'Network unknown'}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
