'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLockup } from '@/components/BrandLockup';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-layout">
        <div className="auth-layout-center">
          <div className="auth-brand-block">
            <h1>
              <BrandLockup className="auth-lockup" />
            </h1>
            <h2 className="auth-title">{title}</h2>
          </div>
          <div className="auth-form-wrap">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthFooterLink({ href, label, prefix }: { href: string; label: string; prefix: string }) {
  return (
    <p className="auth-footer">
      {prefix}{' '}
      <Link href={href} className="auth-link">
        {label}
      </Link>
    </p>
  );
}
