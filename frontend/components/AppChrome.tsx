'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChatWidget } from '@/components/ChatWidget';
import { ApolloAppProvider } from '@/components/ApolloAppProvider';

const APP_PREFIXES = [
  '/dashboard',
  '/payouts',
  '/challenges',
  '/accounts',
  '/competitions',
  '/leaderboards',
  '/certificates',
  '/economic-calendar',
  '/tools',
  '/trade-copier',
  '/affiliate',
  '/settings',
  '/admin',
  '/graphql-lab',
];

const AUTH_PREFIXES = ['/login', '/register', '/forgot-password'];

function isAppRoute(pathname: string) {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthRoute(pathname: string) {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  const body = (() => {
    if (isAppRoute(pathname)) {
      return (
        <>
          <AppShell>{children}</AppShell>
          <ChatWidget />
        </>
      );
    }

    if (isAuthRoute(pathname)) {
      return (
        <>
          {children}
          <ChatWidget />
        </>
      );
    }

    return (
      <>
        <header className="top">
          <Link href="/" className="brand">
            PropFirm
          </Link>
          <nav>
            <Link href="/">Catalog</Link>
            <Link href="/accounts">Accounts</Link>
            <Link href="/payouts">Payouts</Link>
            <Link href="/admin">Admin</Link>
            <Link href="/login">Login</Link>
            <Link href="/graphql-lab">GraphQL</Link>
          </nav>
        </header>
        <main className="main">{children}</main>
        <ChatWidget />
      </>
    );
  })();

  return <ApolloAppProvider>{body}</ApolloAppProvider>;
}
