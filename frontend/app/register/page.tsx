'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFooterLink, AuthLayout } from '@/components/AuthLayout';
import { api, saveSession, AuthSession } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      let clientIp: string | undefined;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(3000),
        });
        if (ipRes.ok) {
          const ipJson = (await ipRes.json()) as { ip?: string };
          clientIp = ipJson.ip;
        }
      } catch {
        /* optional */
      }
      const session = await api<AuthSession>('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || email.split('@')[0],
          clientIp,
        }),
      });
      saveSession(session);
      router.push('/accounts');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err ? <p className="auth-err">{err}</p> : null}
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <AuthFooterLink href="/login" prefix="Already have an account?" label="Sign in" />
    </AuthLayout>
  );
}
