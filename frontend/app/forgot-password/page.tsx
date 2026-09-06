'use client';

import { FormEvent, useState } from 'react';
import { AuthFooterLink, AuthLayout } from '@/components/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <AuthLayout title="Reset your password">
      {sent ? (
        <p className="auth-sent">
          If an account exists for <strong>{email}</strong>, a reset link would be sent. (Demo — no email is
          sent.)
        </p>
      ) : (
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
          <button className="auth-submit" type="submit">
            Send reset link
          </button>
        </form>
      )}
      <AuthFooterLink href="/login" prefix="Remembered it?" label="Back to sign in" />
    </AuthLayout>
  );
}
