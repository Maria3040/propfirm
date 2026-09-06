'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFooterLink, AuthLayout } from '@/components/AuthLayout';
import { api, saveSession, AuthSession } from '@/lib/api';

const REMEMBER_KEY = 'pf-remember-email';

function GoogleIcon() {
  return (
    <svg height="24" viewBox="0 0 24 24" width="24" className="auth-google-icon" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search.get('next');
  const next = nextParam || '/accounts';
  const [email, setEmail] = useState('trader@propfirm.local');
  const [password, setPassword] = useState('Trader1!');
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

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
        /* optional enrichment */
      }
      const session = await api<AuthSession>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password, clientIp }),
      });
      saveSession(session);
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
      // Admins land on the control panel unless a non-default next was requested.
      let path = next.startsWith('/') ? next.split('#')[0] : '/accounts';
      if (session.role === 'Admin' && (!nextParam || nextParam === '/accounts' || nextParam === '/dashboard')) {
        path = '/admin';
      }
      router.push(path);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Sign in to your account">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="auth-row">
          <label className="auth-check">
            <input
              type="checkbox"
              name="rememberMe"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember Me</span>
          </label>
          <Link href="/forgot-password" className="auth-link">
            Forgot Password?
          </Link>
        </div>

        {err ? <p className="auth-err">{err}</p> : null}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="auth-or">
          <p>OR</p>
          <button
            type="button"
            className="auth-google"
            onClick={() => setErr('Google sign-in is a demo stub in this build.')}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </form>

      <AuthFooterLink href="/register" prefix="Ready to trade?" label="Create your account" />
      <p className="auth-demo-hint">Demo: trader@propfirm.local / Trader1!</p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><p className="auth-loading">Loading…</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
