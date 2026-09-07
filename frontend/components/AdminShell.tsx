'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { logoutSession } from '@/lib/api';
import type { RootState } from '@/store';

const ADMIN_NAV = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'payouts', label: 'Payouts' },
  { tab: 'verifications', label: 'Verifications' },
  { tab: 'traders', label: 'Traders' },
  { tab: 'challenges', label: 'Challenges' },
  { tab: 'catalog', label: 'Catalog' },
  { tab: 'audit', label: 'Audit' },
  { tab: 'mail', label: 'Mail' },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const current = search.get('tab') || 'overview';

  async function onLogout() {
    await logoutSession().catch(() => undefined);
    router.replace('/login?next=/admin');
  }

  function go(tab: (typeof ADMIN_NAV)[number]['tab']) {
    // Client replace avoids full remount jank; keep sidebar height stable.
    if (tab === 'overview') router.replace('/admin');
    else router.replace(`/admin?tab=${tab}`);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-shell-sidebar" aria-label="Admin navigation">
        <div className="admin-shell-brand">
          <span className="admin-shell-badge">Admin</span>
          <strong>PropFirm Control</strong>
          <p>{user?.displayName || 'Admin'}</p>
          <p className="admin-shell-email">{user?.email || 'admin@propfirm.local'}</p>
        </div>
        <nav className="admin-shell-nav">
          {ADMIN_NAV.map((item) => {
            const on = pathname === '/admin' && current === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                className={on ? 'on' : ''}
                aria-current={on ? 'page' : undefined}
                onClick={() => go(item.tab)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="admin-shell-footer">
          <Link href="/">View marketing site</Link>
          <button type="button" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-shell-main">{children}</div>
    </div>
  );
}
