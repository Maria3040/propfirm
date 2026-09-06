'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { SETTINGS_NAV } from '@/lib/settings-data';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/settings/profile';
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = useMemo(
    () => SETTINGS_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)) || SETTINGS_NAV[0],
    [pathname],
  );

  return (
    <div className="settings-layout">
      <aside className="settings-aside">
        <div className="settings-aside-head">
          <h1>Configuration</h1>
        </div>
        <nav className="settings-nav" aria-label="Settings">
          {SETTINGS_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`settings-nav-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="settings-main">
        <div className="settings-mobile-nav">
          <button
            type="button"
            className="settings-mobile-trigger"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span>{current.label}</span>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden className="opacity-50">
              <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
            </svg>
          </button>
          {mobileOpen && (
            <div className="settings-mobile-menu" role="listbox">
              {SETTINGS_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="option"
                  aria-selected={item.href === current.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
