'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getSession } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type VerificationState = {
  status: string;
  requestedAt?: string | null;
  decidedAt?: string | null;
  adminComment?: string | null;
};

function ShieldIcon() {
  return (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function badgeLabel(status: string) {
  switch (status) {
    case 'Pending':
      return 'In Progress';
    case 'Approved':
      return 'Verified';
    case 'Rejected':
      return 'Rejected';
    default:
      return 'Not Verified';
  }
}

export default function VerifySettingsPage() {
  const { ready, authenticated } = useRequireAuth('/settings/verify');
  const [state, setState] = useState<VerificationState>({ status: 'None' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    if (!getSession()) return;
    try {
      const next = await api<VerificationState>('/api/users/me/verification');
      setState(next);
      if (next.status === 'Approved') {
        setMsg('Your identity is verified.');
      } else if (next.status === 'Rejected') {
        setMsg(next.adminComment ? `Rejected: ${next.adminComment}` : 'Verification was rejected.');
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load verification status');
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refresh();
  }, [authenticated, refresh]);

  // While pending, poll so admin approve flips UI to Verified without a full page reload.
  useEffect(() => {
    if (!authenticated || state.status !== 'Pending') return;
    const tick = window.setInterval(() => void refresh(), 4000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [authenticated, state.status, refresh]);

  async function start() {
    setErr('');
    setMsg('');
    if (!getSession()) return;
    setBusy(true);
    try {
      const next = await api<VerificationState>('/api/users/me/verification/start', {
        method: 'POST',
        body: '{}',
      });
      setState(next);
      if (next.status === 'Approved') {
        setMsg('Your identity is already verified.');
      } else {
        setMsg('Verification submitted. This page updates when an admin decides (email via Mailpit).');
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to start verification');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !authenticated) {
    return (
      <div className="settings-page">
        <h1 className="settings-page-title">Account Verification</h1>
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  const pending = state.status === 'Pending';
  const approved = state.status === 'Approved';
  const rejected = state.status === 'Rejected';
  const canStart = state.status === 'None' || rejected;

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Account Verification</h1>

      <div className="sv-card">
        <div className="sv-card-top">
          <div className="sv-status-row">
            <div className="sv-status-lead">
              <span className="sv-status-icon">
                <ShieldIcon />
              </span>
              <div>
                <h3>
                  {approved
                    ? 'Identity Verified'
                    : pending
                      ? 'Verification In Review'
                      : rejected
                        ? 'Verification Rejected'
                        : 'Identity Verification Available'}
                </h3>
                <p>
                  {approved
                    ? 'Your account identity has been approved.'
                    : pending
                      ? 'An admin is reviewing your request. Status updates automatically.'
                      : rejected
                        ? 'You can submit again after reviewing the admin comment.'
                        : 'You can now verify your identity'}
                </p>
              </div>
            </div>
            <span className={`sv-badge${approved ? ' ok' : ''}${rejected ? ' bad' : ''}${pending ? ' pending' : ''}`}>
              {badgeLabel(state.status)}
            </span>
          </div>
        </div>

        <div className="sv-card-body">
          <div className="sv-start-panel">
            <div className="sv-start-inner">
              <h3>
                {pending
                  ? 'Verification Pending'
                  : approved
                    ? 'You are verified'
                    : 'Start Verification'}
              </h3>
              <p>
                {pending
                  ? 'Waiting for admin review…'
                  : approved
                    ? state.adminComment || 'No further action needed.'
                    : 'Verify your identity to unlock additional features. Admin review is required.'}
              </p>
              {state.adminComment && (rejected || approved) ? (
                <p className="meta">Admin comment: {state.adminComment}</p>
              ) : null}
              {err ? <p className="err" role="alert">{err}</p> : null}
              {msg ? <p className="settings-saved">{msg}</p> : null}
              {canStart ? (
                <button
                  type="button"
                  className="settings-save-btn sv-start-btn"
                  onClick={() => void start()}
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? 'Submitting…' : rejected ? 'Resubmit Verification' : 'Start Verification'}
                </button>
              ) : (
                <button type="button" className="settings-save-btn sv-start-btn" disabled>
                  {pending ? 'Waiting for admin…' : 'Verified'}
                </button>
              )}
            </div>
            <span className="sv-powered">
              <CheckIcon /> Powered by KYCAID
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
